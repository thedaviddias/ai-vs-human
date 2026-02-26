import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
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

// ─── Paginated query for action-based stats computation ──────────────

/**
 * Returns a page of commits for a repo, used by the classifyPRs action
 * to read commits in batches and stay under the 16 MB read limit.
 */
export const getCommitsBatch = internalQuery({
  args: {
    repoId: v.id("repos"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("commits")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .paginate(args.paginationOpts);
  },
});

// ─── Write-only stats mutation ───────────────────────────────────────

const weeklyStatValidator = v.object({
  weekStart: v.number(),
  weekLabel: v.string(),
  human: v.number(),
  dependabot: v.number(),
  renovate: v.number(),
  copilot: v.number(),
  claude: v.number(),
  cursor: v.number(),
  aider: v.number(),
  devin: v.number(),
  openaiCodex: v.number(),
  gemini: v.number(),
  githubActions: v.number(),
  otherBot: v.number(),
  aiAssisted: v.number(),
  total: v.number(),
  humanAdditions: v.number(),
  copilotAdditions: v.number(),
  claudeAdditions: v.number(),
  cursorAdditions: v.number(),
  aiderAdditions: v.number(),
  devinAdditions: v.number(),
  openaiCodexAdditions: v.number(),
  geminiAdditions: v.number(),
  aiAssistedAdditions: v.number(),
  totalAdditions: v.number(),
  totalDeletions: v.number(),
});

const dailyStatValidator = v.object({
  date: v.number(),
  human: v.number(),
  ai: v.number(),
  automation: v.number(),
  humanAdditions: v.number(),
  aiAdditions: v.number(),
  automationAdditions: v.number(),
});

const contributorStatValidator = v.object({
  login: v.optional(v.string()),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  classification: v.string(),
  commitCount: v.number(),
  additions: v.number(),
  deletions: v.number(),
  firstCommitAt: v.number(),
  lastCommitAt: v.number(),
});

/**
 * Writes pre-computed stats to the database.
 *
 * Called by the classifyPRs action after it has read all commits via
 * paginated queries and computed stats in action memory. This mutation
 * only touches the stats tables (not commits), keeping reads well under 16 MB.
 */
export const writeRepoStats = internalMutation({
  args: {
    repoId: v.id("repos"),
    weeklyStats: v.array(weeklyStatValidator),
    dailyStats: v.array(dailyStatValidator),
    contributorStats: v.array(contributorStatValidator),
    toolBreakdown: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        commits: v.number(),
        additions: v.number(),
      })
    ),
    botBreakdown: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        commits: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Delete existing weekly stats
    const existingWeekly = await ctx.db
      .query("repoWeeklyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();
    for (const stat of existingWeekly) {
      await ctx.db.delete(stat._id);
    }

    // 2. Delete existing daily stats
    const existingDaily = await ctx.db
      .query("repoDailyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();
    for (const d of existingDaily) {
      await ctx.db.delete(d._id);
    }

    // 3. Delete existing contributor stats
    const existingContribs = await ctx.db
      .query("repoContributorStats")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();
    for (const contrib of existingContribs) {
      await ctx.db.delete(contrib._id);
    }

    // 4. Insert new weekly stats
    for (const stat of args.weeklyStats) {
      await ctx.db.insert("repoWeeklyStats", {
        repoId: args.repoId,
        ...stat,
      });
    }

    // 5. Insert new daily stats
    for (const stat of args.dailyStats) {
      await ctx.db.insert("repoDailyStats", {
        repoId: args.repoId,
        ...stat,
      });
    }

    // 6. Insert new contributor stats
    for (const contrib of args.contributorStats) {
      await ctx.db.insert("repoContributorStats", {
        repoId: args.repoId,
        ...contrib,
      });
    }

    // 7. Persist tool/bot breakdown on the repo document
    await ctx.db.patch(args.repoId, {
      toolBreakdown: args.toolBreakdown,
      botBreakdown: args.botBreakdown,
    });
  },
});

/**
 * Cleans up individual commit rows after stats have been aggregated.
 *
 * GitHub remains the source of truth for raw commit data — we only need
 * individual commits during the sync pipeline (insert → LOC enrichment →
 * PR classification → stats aggregation). Once writeRepoStats has
 * persisted the weekly/contributor stats, the raw rows are no longer needed.
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
