import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/authHelpers";

/**
 * Auth-gated mutation: toggles whether private activity is visible to visitors.
 *
 * When `showPrivateDataPublicly` is true (default), visitors see merged
 * public+private data on the profile page and leaderboard cards.
 * When false, visitors see public-only data — the owner still sees
 * their full merged view.
 */
export const updatePrivateVisibility = mutation({
  args: { showPrivateDataPublicly: v.boolean() },
  handler: async (ctx, { showPrivateDataPublicly }) => {
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

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
      .unique();

    if (!profile) {
      throw new Error("Profile not found. Submit your username first to create a profile.");
    }

    await ctx.db.patch(profile._id, { showPrivateDataPublicly });

    return { success: true };
  },
});
