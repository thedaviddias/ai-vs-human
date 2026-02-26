import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Returns the private data sync status for a GitHub user.
 * Used by the frontend to show sync progress and "includes private data" badge.
 */
export const getUserPrivateSyncStatus = query({
  args: { githubLogin: v.string() },
  handler: async (ctx, { githubLogin }) => {
    return ctx.db
      .query("userPrivateSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();
  },
});

/**
 * Returns private daily stats for a user (for heatmap merging).
 */
export const getUserPrivateDailyStats = query({
  args: { githubLogin: v.string() },
  handler: async (ctx, { githubLogin }) => {
    return ctx.db
      .query("userPrivateDailyStats")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .collect();
  },
});

/**
 * Returns private weekly stats for a user (for chart merging).
 */
export const getUserPrivateWeeklyStats = query({
  args: { githubLogin: v.string() },
  handler: async (ctx, { githubLogin }) => {
    return ctx.db
      .query("userPrivateWeeklyStats")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .collect();
  },
});
