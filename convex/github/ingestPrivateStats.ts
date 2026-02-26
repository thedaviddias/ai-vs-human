import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { DailyStatEntry, WeeklyStatEntry } from "./statsComputation";

/**
 * Writes (replace) aggregate private stats for a user.
 *
 * Called by `privateRepoSync` after all private repo commits have been
 * classified IN MEMORY. The data written here contains:
 * - githubLogin (who the stats belong to)
 * - numbers (human/ai/automation counts per day/week)
 *
 * It does NOT contain: repo names, commit SHAs, commit messages,
 * file paths, or any other identifying information about private repos.
 */

export const replacePrivateDailyStats = internalMutation({
  args: {
    githubLogin: v.string(),
    dailyStats: v.array(
      v.object({
        date: v.number(),
        human: v.number(),
        ai: v.number(),
        automation: v.number(),
        humanAdditions: v.number(),
        aiAdditions: v.number(),
        automationAdditions: v.number(),
      })
    ),
    isFirstBatch: v.optional(v.boolean()),
  },
  handler: async (ctx, { githubLogin, dailyStats, isFirstBatch = true }) => {
    // Only delete existing stats if this is the first batch
    if (isFirstBatch) {
      const existing = await ctx.db
        .query("userPrivateDailyStats")
        .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
        .collect();

      for (const row of existing) {
        await ctx.db.delete(row._id);
      }
    }

    // Insert fresh aggregated daily stats
    for (const day of dailyStats) {
      await ctx.db.insert("userPrivateDailyStats", {
        githubLogin,
        ...day,
      });
    }
  },
});

export const replacePrivateWeeklyStats = internalMutation({
  args: {
    githubLogin: v.string(),
    weeklyStats: v.array(
      v.object({
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
        humanAdditions: v.optional(v.number()),
        copilotAdditions: v.optional(v.number()),
        claudeAdditions: v.optional(v.number()),
        cursorAdditions: v.optional(v.number()),
        aiderAdditions: v.optional(v.number()),
        devinAdditions: v.optional(v.number()),
        openaiCodexAdditions: v.optional(v.number()),
        geminiAdditions: v.optional(v.number()),
        aiAssistedAdditions: v.optional(v.number()),
        totalAdditions: v.optional(v.number()),
        totalDeletions: v.optional(v.number()),
      })
    ),
    isFirstBatch: v.optional(v.boolean()),
  },
  handler: async (ctx, { githubLogin, weeklyStats, isFirstBatch = true }) => {
    // Only delete existing stats if this is the first batch
    if (isFirstBatch) {
      const existing = await ctx.db
        .query("userPrivateWeeklyStats")
        .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
        .collect();

      for (const row of existing) {
        await ctx.db.delete(row._id);
      }
    }

    // Insert fresh aggregated weekly stats
    for (const week of weeklyStats) {
      await ctx.db.insert("userPrivateWeeklyStats", {
        githubLogin,
        ...week,
      });
    }
  },
});

/**
 * Updates progress counters during private sync.
 * Called after each repo is processed so the UI can show live progress
 * (e.g., "Processing repo 3/12 — 847 commits found").
 *
 * Security: Only stores counts, never repo names or identifiers.
 */
export const updatePrivateSyncProgress = internalMutation({
  args: {
    githubLogin: v.string(),
    totalRepos: v.number(),
    processedRepos: v.number(),
    totalCommitsFound: v.number(),
  },
  handler: async (ctx, { githubLogin, totalRepos, processedRepos, totalCommitsFound }) => {
    const syncStatus = await ctx.db
      .query("userPrivateSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (syncStatus) {
      await ctx.db.patch(syncStatus._id, {
        totalRepos,
        processedRepos,
        totalCommitsFound,
      });
    }
  },
});

/**
 * Marks the private sync as complete and updates the profile.
 */
export const markPrivateSyncComplete = internalMutation({
  args: {
    githubLogin: v.string(),
  },
  handler: async (ctx, { githubLogin }) => {
    // Update sync status
    const syncStatus = await ctx.db
      .query("userPrivateSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (syncStatus) {
      await ctx.db.patch(syncStatus._id, {
        syncStatus: "synced",
        lastSyncedAt: Date.now(),
        includesPrivateData: true,
        // Clear progress counters — no longer relevant once synced
        totalRepos: undefined,
        processedRepos: undefined,
        totalCommitsFound: undefined,
      });
    }

    // Mark profile as having private data
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, { hasPrivateData: true });
    }
  },
});

/**
 * Marks the private sync as failed.
 */
export const markPrivateSyncError = internalMutation({
  args: {
    githubLogin: v.string(),
    error: v.string(),
  },
  handler: async (ctx, { githubLogin, error }) => {
    const syncStatus = await ctx.db
      .query("userPrivateSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (syncStatus) {
      await ctx.db.patch(syncStatus._id, {
        syncStatus: "error",
        syncError: error,
      });
    }
  },
});

// ─── Type re-exports for use in privateRepoSync ──────────────
export type { DailyStatEntry, WeeklyStatEntry };
