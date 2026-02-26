"use node";

import type { PaginationResult } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { buildDetailedBreakdowns } from "../classification/detailedBreakdown";
import { extractPRNumber } from "../classification/knownBots";
import { computeStatsFromCommits } from "./statsComputation";

/**
 * Post-processing step: checks PR metadata for squash/merge commits.
 *
 * Problem: When a PR created by an AI agent (Copilot, Devin, etc.) is
 * squash-merged, the resulting commit has the human as the author.
 * The original AI attribution is lost.
 *
 * Solution: After all commits are fetched, we:
 * 1. Find commits that reference PR numbers (squash merges, merge commits)
 * 2. Batch-fetch PR metadata from GitHub API
 * 3. If the PR was created by a bot, reclassify the commit
 * 4. If the PR body/branch/labels contain AI markers, reclassify as ai-assisted
 * 5. Finalize: recompute stats and mark repo as synced
 */
export const classifyPRs = internalAction({
  args: {
    repoId: v.id("repos"),
    owner: v.string(),
    name: v.string(),
    totalCommits: v.number(),
  },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN;

    // Only attempt PR classification if we have a token
    if (token) {
      try {
        // 1. Get all commits classified as "human" for this repo
        const humanCommits = (await ctx.runQuery(
          internal.github.classifyPRsHelpers.getHumanCommits,
          { repoId: args.repoId }
        )) as Array<{
          _id: Id<"commits">;
          message: string;
          fullMessage?: string;
        }>;

        // 2. Extract PR numbers from commit messages
        const prCommitMap = new Map<number, Id<"commits">[]>();
        for (const commit of humanCommits) {
          const msg = commit.fullMessage ?? commit.message;
          const prNumber = extractPRNumber(msg);
          if (prNumber) {
            const existing = prCommitMap.get(prNumber) ?? [];
            existing.push(commit._id);
            prCommitMap.set(prNumber, existing);
          }
        }

        if (prCommitMap.size > 0) {
          // 3. Fetch PR metadata from GitHub and classify
          const reclassifications: Array<{
            commitId: Id<"commits">;
            classification: string;
          }> = [];

          for (const prNumber of prCommitMap.keys()) {
            try {
              const prData = await fetchPR(token, args.owner, args.name, prNumber);
              if (!prData) continue;

              const commitIds = prCommitMap.get(prNumber) ?? [];
              const classification = classifyPRAuthor(prData);

              if (classification) {
                for (const commitId of commitIds) {
                  reclassifications.push({ commitId, classification });
                }
              }
            } catch {
              // Skip individual PR fetch errors (e.g., 404 for deleted PRs)
            }
          }

          // 4. Batch-update commit classifications
          if (reclassifications.length > 0) {
            await ctx.runMutation(internal.github.classifyPRsHelpers.reclassifyCommits, {
              reclassifications,
            });
          }
        }
      } catch {
        // PR classification is best-effort — don't block finalization
      }
    }

    // 5. Compute repo stats — paginated reads to stay under 16 MB limit.
    //    Each page reads ~500 commits (~500 KB), well under the 16 MB cap.
    //    Stats are computed in action memory (no transaction limit).
    await ctx.runMutation(internal.github.ingestRepo.updateSyncProgress, {
      repoId: args.repoId,
      syncStage: "computing_stats",
    });

    const allCommits: Doc<"commits">[] = [];
    let isDone = false;
    let cursor: string | null = null;
    while (!isDone) {
      const result: PaginationResult<Doc<"commits">> = await ctx.runQuery(
        internal.github.ingestCommits.getCommitsBatch,
        {
          repoId: args.repoId,
          paginationOpts: { numItems: 500, cursor },
        }
      );
      allCommits.push(...result.page);
      isDone = result.isDone;
      cursor = result.continueCursor;
    }

    // Compute stats in action memory (pure functions, no Convex transaction)
    const { weeklyStats, dailyStats, contributorStats } = computeStatsFromCommits(allCommits);
    const { toolBreakdown, botBreakdown } = buildDetailedBreakdowns(allCommits);

    // Write pre-computed results (lean mutation — only deletes old stats + inserts new)
    await ctx.runMutation(internal.github.ingestCommits.writeRepoStats, {
      repoId: args.repoId,
      weeklyStats,
      dailyStats,
      contributorStats,
      toolBreakdown,
      botBreakdown,
    });

    // 6. Clean up individual commits — stats are now aggregated,
    // GitHub remains the source of truth for raw commit data
    await ctx.runMutation(internal.github.ingestCommits.deleteRepoCommits, {
      repoId: args.repoId,
    });

    // 7. Mark synced and conditionally recompute global stats.
    //    Only recompute global stats when the LAST repo for this owner finishes,
    //    preventing write conflicts from concurrent mutations on the same rows.
    const { hasMorePending } = await ctx.runMutation(internal.github.ingestRepo.markSynced, {
      repoId: args.repoId,
      totalCommits: args.totalCommits,
    });

    if (!hasMorePending) {
      await ctx.runMutation(internal.mutations.recomputeGlobalStats.recomputeGlobalStats, {});
    }
  },
});

// ─── PR data fetching ─────────────────────────────────────────────────

export interface PRData {
  number: number;
  user: {
    login: string;
    type: string; // "User" | "Bot" | "Organization"
  };
  body: string | null;
  labels: Array<{ name: string }>;
  head: {
    ref: string; // Branch name
  };
}

async function fetchPR(
  token: string,
  owner: string,
  name: string,
  prNumber: number
): Promise<PRData | null> {
  const url = `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) return null;
  return response.json();
}

// ─── PR classification patterns ───────────────────────────────────────

// Bot author patterns for PR creators
const PR_BOT_PATTERNS: Array<{ pattern: RegExp; classification: string }> = [
  { pattern: /cursor[- ]?agent/i, classification: "cursor" },
  { pattern: /copilot-swe-agent/i, classification: "copilot" },
  { pattern: /copilot/i, classification: "copilot" },
  { pattern: /devin-ai-integration/i, classification: "devin" },
  { pattern: /devin/i, classification: "devin" },
  { pattern: /sweep/i, classification: "ai-assisted" },
  { pattern: /gemini-code-assist/i, classification: "gemini" },
  { pattern: /amazon-q-developer/i, classification: "ai-assisted" },
  { pattern: /chatgpt-codex-connector/i, classification: "openai-codex" },
  { pattern: /codex/i, classification: "openai-codex" },
  { pattern: /aider/i, classification: "aider" },
  { pattern: /coderabbit/i, classification: "other-bot" },
  { pattern: /sentry/i, classification: "other-bot" },
  { pattern: /\[bot\]$/i, classification: "ai-assisted" },
];

// PR body patterns that indicate AI involvement
const PR_BODY_AI_PATTERNS: Array<{ pattern: RegExp; classification: string }> = [
  { pattern: /Generated with Cursor/i, classification: "cursor" },
  { pattern: /\[Cursor\]/i, classification: "cursor" },
  { pattern: /Generated with Claude Code/i, classification: "claude" },
  { pattern: /Generated with Claude/i, classification: "claude" },
  { pattern: /Generated by GitHub Copilot/i, classification: "copilot" },
  { pattern: /Generated by Copilot/i, classification: "copilot" },
  { pattern: /Created by Devin/i, classification: "devin" },
  { pattern: /aider/i, classification: "aider" },
  { pattern: /gemini/i, classification: "gemini" },
  { pattern: /codex/i, classification: "openai-codex" },
  { pattern: /Generated by Windsurf/i, classification: "ai-assisted" },
  { pattern: /Generated by CodeRabbit/i, classification: "other-bot" },
  { pattern: /\bAI[- ]generated\b/i, classification: "ai-assisted" },
  {
    pattern: /Co-authored-by:.*(?:claude|copilot|cursor|codex|aider|anthropic|openai|cursoragent)/i,
    classification: "ai-assisted",
  },
  { pattern: /\ud83e\udd16 Generated with/i, classification: "ai-assisted" },
];

// Branch name patterns that indicate AI agent involvement
const PR_BRANCH_AI_PATTERNS: Array<{ pattern: RegExp; classification: string }> = [
  { pattern: /^cursor\//i, classification: "cursor" },
  { pattern: /^copilot\//i, classification: "copilot" },
  { pattern: /^devin\//i, classification: "devin" },
  { pattern: /^codex\//i, classification: "openai-codex" },
  { pattern: /^openai-codex\//i, classification: "openai-codex" },
  { pattern: /^aider\//i, classification: "aider" },
  { pattern: /^gemini\//i, classification: "gemini" },
  { pattern: /^sweep\//i, classification: "ai-assisted" },
  { pattern: /^amazon-q\//i, classification: "ai-assisted" },
  { pattern: /^windsurf\//i, classification: "ai-assisted" },
  { pattern: /^coderabbit\//i, classification: "other-bot" },
  { pattern: /^ai[-/]/i, classification: "ai-assisted" },
];

// PR label patterns that indicate AI involvement
const PR_LABEL_AI_PATTERNS: RegExp[] = [/ai[- ]generated/i, /copilot/i, /automated/i];

/**
 * Determines if a PR was created by or with AI assistance.
 * Returns the classification string if AI-involved, null otherwise.
 *
 * Checks (in priority order):
 * 1. PR author is a bot account → specific classification
 * 2. PR author login matches known AI patterns → specific classification
 * 3. PR branch name matches AI patterns → "ai-assisted"
 * 4. PR body contains AI markers → "ai-assisted"
 * 5. PR labels indicate AI → "ai-assisted"
 */
export function classifyPRAuthor(pr: PRData): string | null {
  // 1. Bot account type
  if (pr.user.type === "Bot") {
    for (const { pattern, classification } of PR_BOT_PATTERNS) {
      if (pattern.test(pr.user.login)) {
        return classification;
      }
    }
    return "ai-assisted";
  }

  // 2. Known AI bot login patterns (some don't register as "Bot" type)
  for (const { pattern, classification } of PR_BOT_PATTERNS) {
    if (pattern.test(pr.user.login)) {
      return classification;
    }
  }

  // 3. Branch name patterns
  const branchName = pr.head?.ref ?? "";
  for (const { pattern, classification } of PR_BRANCH_AI_PATTERNS) {
    if (pattern.test(branchName)) {
      return classification;
    }
  }

  // 4. PR body AI markers
  const body = pr.body ?? "";
  for (const { pattern, classification } of PR_BODY_AI_PATTERNS) {
    if (pattern.test(body)) {
      return classification;
    }
  }

  // 5. PR labels
  for (const label of pr.labels) {
    for (const pattern of PR_LABEL_AI_PATTERNS) {
      if (pattern.test(label.name)) {
        return "ai-assisted";
      }
    }
  }

  return null;
}
