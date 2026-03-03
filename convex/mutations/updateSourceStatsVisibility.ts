import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/authHelpers";

/**
 * Auth-gated mutation: toggles whether source-level stats are publicly visible.
 *
 * Defaults to false (private). When true, visitors can see source overlays
 * (e.g. Cursor accepted lines) on the profile dashboard.
 */
export const updateSourceStatsVisibility = mutation({
  args: { showSourceStatsPublicly: v.boolean() },
  handler: async (ctx, { showSourceStatsPublicly }) => {
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

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
      .unique();

    if (!profile) {
      throw new Error("Profile not found. Submit your username first to create a profile.");
    }

    await ctx.db.patch(profile._id, { showSourceStatsPublicly });

    return { success: true };
  },
});

/**
 * Internal-only mutation used by trusted backend routes after desktop-token verification.
 * Not callable from browser clients.
 */
export const setSourceStatsVisibilityByLogin = internalMutation({
  args: {
    githubLogin: v.string(),
    showSourceStatsPublicly: v.boolean(),
  },
  handler: async (ctx, { githubLogin, showSourceStatsPublicly }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
      .unique();

    if (!profile) {
      throw new Error("Profile not found. Submit your username first to create a profile.");
    }

    await ctx.db.patch(profile._id, { showSourceStatsPublicly });

    return {
      success: true,
      showSourceStatsPublicly,
    };
  },
});
