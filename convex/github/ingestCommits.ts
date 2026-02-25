import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { classificationToField } from "../classification/botDetector";
import { buildDetailedBreakdowns } from "../classification/detailedBreakdown";
import { classificationValidator } from "../lib/validators";

const commitArg = v.object({
  sha: v.string(),
  message: v.string(),
  fullMessage: v.optional(v.string()),
  authoredAt: v.number(),
  committedAt: v.number(),
  authorName: v.optional(v.string()),
  authorEmail: v.optional(v.string()),
  authorGithubUserId: v.optional(v.number()),
  authorLogin: v.optional(v.string()),
  authorType: v.optional(v.string()),
  committerName: v.optional(v.string()),
  committerEmail: v.optional(v.string()),
  classification: classificationValidator,
  coAuthors: v.optional(v.array(v.string())),
  additions: v.optional(v.number()),
  deletions: v.optional(v.number()),
});

export const batchInsert = internalMutation({
  args: {
    repoId: v.id("repos"),
    commits: v.array(commitArg),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const commit of args.commits) {
      const existing = await ctx.db
        .query("commits")
        .withIndex("by_sha", (q) => q.eq("sha", commit.sha))
        .first();

      if (existing) {
        // Update classification + co-authors on re-sync so new detection
        // logic takes effect without needing to delete and re-insert
        if (
          existing.classification !== commit.classification ||
          JSON.stringify(existing.coAuthors) !== JSON.stringify(commit.coAuthors)
        ) {
          await ctx.db.patch(existing._id, {
            classification: commit.classification,
            coAuthors: commit.coAuthors,
            fullMessage: commit.fullMessage,
          });
        }
        continue;
      }

      await ctx.db.insert("commits", {
        repoId: args.repoId,
        ...commit,
      });
      inserted++;
    }
    return inserted;
  },
});

/**
 * Patches stored commits with additions/deletions from the GraphQL enrichment step.
 * Uses the by_sha index for O(1) lookup per SHA.
 */
export const batchUpdateLoc = internalMutation({
  args: {
    updates: v.array(
      v.object({
        sha: v.string(),
        additions: v.number(),
        deletions: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let updated = 0;
    for (const update of args.updates) {
      const existing = await ctx.db
        .query("commits")
        .withIndex("by_sha", (q) => q.eq("sha", update.sha))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          additions: update.additions,
          deletions: update.deletions,
        });
        updated++;
      }
    }
    return updated;
  },
});

function getDayStart(epochMs: number): number {
  const d = new Date(epochMs);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function getWeekStart(epochMs: number): number {
  const date = new Date(epochMs);
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

/**
 * Returns an ISO 8601 week label (e.g. "2025-W01") for a given timestamp.
 * Uses the ISO week-numbering year — the year of the Thursday in the same week.
 */
function formatWeekLabel(weekStartMs: number): string {
  const date = new Date(weekStartMs);
  const day = date.getUTCDay();
  const thursdayOffset = day === 0 ? -3 : 4 - day;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + thursdayOffset);

  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay();
  const startOfIsoYear = new Date(jan4);
  startOfIsoYear.setUTCDate(jan4.getUTCDate() - (jan4Day === 0 ? 6 : jan4Day - 1));

  const diffMs = thursday.getTime() - startOfIsoYear.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

type Classification =
  | "human"
  | "dependabot"
  | "renovate"
  | "copilot"
  | "claude"
  | "cursor"
  | "aider"
  | "devin"
  | "openai-codex"
  | "gemini"
  | "github-actions"
  | "other-bot"
  | "ai-assisted";

interface WeekBucket {
  human: number;
  dependabot: number;
  renovate: number;
  copilot: number;
  claude: number;
  cursor: number;
  aider: number;
  devin: number;
  openaiCodex: number;
  gemini: number;
  githubActions: number;
  otherBot: number;
  aiAssisted: number;
  total: number;
  // LOC per classification (additions only, for AI tool categories + human)
  humanAdditions: number;
  copilotAdditions: number;
  claudeAdditions: number;
  cursorAdditions: number;
  aiderAdditions: number;
  devinAdditions: number;
  openaiCodexAdditions: number;
  geminiAdditions: number;
  aiAssistedAdditions: number;
  totalAdditions: number;
  totalDeletions: number;
}

function emptyBucket(): WeekBucket {
  return {
    human: 0,
    dependabot: 0,
    renovate: 0,
    copilot: 0,
    claude: 0,
    cursor: 0,
    aider: 0,
    devin: 0,
    openaiCodex: 0,
    gemini: 0,
    githubActions: 0,
    otherBot: 0,
    aiAssisted: 0,
    total: 0,
    humanAdditions: 0,
    copilotAdditions: 0,
    claudeAdditions: 0,
    cursorAdditions: 0,
    aiderAdditions: 0,
    devinAdditions: 0,
    openaiCodexAdditions: 0,
    geminiAdditions: 0,
    aiAssistedAdditions: 0,
    totalAdditions: 0,
    totalDeletions: 0,
  };
}

export const recomputeRepoStats = internalMutation({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    // Delete existing weekly stats
    const existingStats = await ctx.db
      .query("repoWeeklyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();
    for (const stat of existingStats) {
      await ctx.db.delete(stat._id);
    }

    // Delete existing contributor stats
    const existingContribs = await ctx.db
      .query("repoContributorStats")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();
    for (const contrib of existingContribs) {
      await ctx.db.delete(contrib._id);
    }

    // Fetch all commits for this repo
    const commits = await ctx.db
      .query("commits")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();

    // Group by week + day
    const weekBuckets = new Map<number, WeekBucket>();
    const dayBuckets = new Map<
      number,
      {
        human: number;
        ai: number;
        automation: number;
        humanAdditions: number;
        aiAdditions: number;
        automationAdditions: number;
      }
    >();

    const AI_TOOL_CLASSIFICATIONS = new Set([
      "copilot",
      "claude",
      "cursor",
      "aider",
      "devin",
      "openai-codex",
      "gemini",
      "ai-assisted",
    ]);

    for (const commit of commits) {
      const weekStart = getWeekStart(commit.authoredAt);
      if (!weekBuckets.has(weekStart)) {
        weekBuckets.set(weekStart, emptyBucket());
      }
      const bucket = weekBuckets.get(weekStart)!;
      const field = classificationToField(
        commit.classification as Classification
      ) as keyof WeekBucket;
      (bucket[field] as number)++;
      bucket.total++;

      // Aggregate LOC (additions) per classification — only AI tools + human
      const adds = commit.additions ?? 0;
      const dels = commit.deletions ?? 0;
      switch (commit.classification) {
        case "human":
          bucket.humanAdditions += adds;
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
        case "copilot":
          bucket.copilotAdditions += adds;
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
        case "claude":
          bucket.claudeAdditions += adds;
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
        case "cursor":
          bucket.cursorAdditions += adds;
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
        case "aider":
          bucket.aiderAdditions += adds;
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
        case "devin":
          bucket.devinAdditions += adds;
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
        case "openai-codex":
          bucket.openaiCodexAdditions += adds;
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
        case "gemini":
          bucket.geminiAdditions += adds;
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
        case "ai-assisted":
          bucket.aiAssistedAdditions += adds;
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
        default:
          // Automation bots: dependabot, renovate, github-actions, other-bot
          bucket.totalAdditions += adds;
          bucket.totalDeletions += dels;
          break;
      }

      // Daily bucketing — 3-way split: human / AI / automation
      const dayStart = getDayStart(commit.authoredAt);
      const dayBucket = dayBuckets.get(dayStart) ?? {
        human: 0,
        ai: 0,
        automation: 0,
        humanAdditions: 0,
        aiAdditions: 0,
        automationAdditions: 0,
      };

      if (commit.classification === "human") {
        dayBucket.human++;
        dayBucket.humanAdditions += adds;
      } else if (AI_TOOL_CLASSIFICATIONS.has(commit.classification)) {
        dayBucket.ai++;
        dayBucket.aiAdditions += adds;
      } else {
        // Automation bots: dependabot, renovate, github-actions, other-bot
        dayBucket.automation++;
        dayBucket.automationAdditions += adds;
      }
      dayBuckets.set(dayStart, dayBucket);
    }

    // Insert weekly stats
    for (const [weekStart, counts] of weekBuckets) {
      await ctx.db.insert("repoWeeklyStats", {
        repoId: args.repoId,
        weekStart,
        weekLabel: formatWeekLabel(weekStart),
        ...counts,
      });
    }

    // Delete existing daily stats for this repo
    const existingDaily = await ctx.db
      .query("repoDailyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();
    for (const d of existingDaily) {
      await ctx.db.delete(d._id);
    }

    // Insert daily stats
    for (const [date, counts] of dayBuckets) {
      await ctx.db.insert("repoDailyStats", {
        repoId: args.repoId,
        date,
        ...counts,
      });
    }

    // Compute contributor stats with majority-vote classification.
    // A contributor's classification is determined by their most frequent
    // classification across all commits, not just the first commit seen.
    const contributorMap = new Map<
      string,
      {
        login?: string;
        name?: string;
        email?: string;
        avatarUrl?: string;
        classificationCounts: Map<string, number>;
        commitCount: number;
        additions: number;
        deletions: number;
        firstCommitAt: number;
        lastCommitAt: number;
      }
    >();

    for (const commit of commits) {
      const key = commit.authorLogin ?? commit.authorEmail ?? commit.authorName ?? "unknown";
      const existing = contributorMap.get(key);
      if (existing) {
        existing.commitCount++;
        existing.additions += commit.additions ?? 0;
        existing.deletions += commit.deletions ?? 0;
        existing.firstCommitAt = Math.min(existing.firstCommitAt, commit.authoredAt);
        existing.lastCommitAt = Math.max(existing.lastCommitAt, commit.authoredAt);
        existing.classificationCounts.set(
          commit.classification,
          (existing.classificationCounts.get(commit.classification) ?? 0) + 1
        );
      } else {
        const counts = new Map<string, number>();
        counts.set(commit.classification, 1);
        contributorMap.set(key, {
          login: commit.authorLogin ?? undefined,
          name: commit.authorName ?? undefined,
          email: commit.authorEmail ?? undefined,
          classificationCounts: counts,
          commitCount: 1,
          additions: commit.additions ?? 0,
          deletions: commit.deletions ?? 0,
          firstCommitAt: commit.authoredAt,
          lastCommitAt: commit.authoredAt,
        });
      }
    }

    for (const contrib of contributorMap.values()) {
      // Pick the classification with the most commits (majority vote)
      let bestClassification = "human";
      let bestCount = 0;
      for (const [cls, count] of contrib.classificationCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestClassification = cls;
        }
      }

      await ctx.db.insert("repoContributorStats", {
        repoId: args.repoId,
        login: contrib.login,
        name: contrib.name,
        email: contrib.email,
        classification: bestClassification,
        commitCount: contrib.commitCount,
        additions: contrib.additions,
        deletions: contrib.deletions,
        firstCommitAt: contrib.firstCommitAt,
        lastCommitAt: contrib.lastCommitAt,
      });
    }

    // Persist granular tool/bot breakdown on the repo document.
    // This runs while commits still exist — after this, commits are deleted.
    const { toolBreakdown, botBreakdown } = buildDetailedBreakdowns(commits);
    await ctx.db.patch(args.repoId, { toolBreakdown, botBreakdown });
  },
});

/**
 * Cleans up individual commit rows after stats have been aggregated.
 *
 * GitHub remains the source of truth for raw commit data — we only need
 * individual commits during the sync pipeline (insert → LOC enrichment →
 * PR classification → stats aggregation). Once recomputeRepoStats has
 * produced the weekly/contributor stats, the raw rows are no longer needed.
 *
 * Uses self-scheduling pagination (500 per batch) to avoid exceeding
 * Convex mutation time/operation limits on large repos.
 */
export const deleteRepoCommits = internalMutation({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    const BATCH_SIZE = 500;
    const commits = await ctx.db
      .query("commits")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .take(BATCH_SIZE);

    for (const commit of commits) {
      await ctx.db.delete(commit._id);
    }

    // If we deleted a full batch, there may be more — schedule another pass
    if (commits.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.github.ingestCommits.deleteRepoCommits, {
        repoId: args.repoId,
      });
    }
  },
});
