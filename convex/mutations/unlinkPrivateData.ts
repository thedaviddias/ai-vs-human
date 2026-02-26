import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/authHelpers";

/**
 * Auth-gated mutation: permanently deletes ALL private repo aggregate stats.
 *
 * After this runs:
 * - All userPrivateDailyStats for this user are deleted
 * - All userPrivateWeeklyStats for this user are deleted
 * - The userPrivateSyncStatus is reset to "idle"
 * - The profile's hasPrivateData flag is cleared
 *
 * The heatmap will revert to showing only public repo data.
 */
export const unlinkPrivateData = mutation({
  args: {},
  handler: async (ctx) => {
    // Verify authentication
    // getAuthUser throws ConvexError("Unauthenticated") instead of returning null
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required. Please sign out and sign back in.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new Error("Cannot determine GitHub login. Please sign out and sign back in.");
    }

    // Delete all private daily stats
    const dailyStats = await ctx.db
      .query("userPrivateDailyStats")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .collect();

    for (const row of dailyStats) {
      await ctx.db.delete(row._id);
    }

    // Delete all private weekly stats
    const weeklyStats = await ctx.db
      .query("userPrivateWeeklyStats")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .collect();

    for (const row of weeklyStats) {
      await ctx.db.delete(row._id);
    }

    // Reset sync status
    const syncStatus = await ctx.db
      .query("userPrivateSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (syncStatus) {
      await ctx.db.patch(syncStatus._id, {
        syncStatus: "idle",
        includesPrivateData: false,
        syncError: undefined,
      });
    }

    // Clear profile flag
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, { hasPrivateData: false });
    }

    return { success: true };
  },
});
