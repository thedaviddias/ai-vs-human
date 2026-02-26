import { components, internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/authHelpers";

/**
 * Auth-gated mutation: triggers the private repo sync pipeline.
 *
 * Flow:
 * 1. Verify the user is authenticated
 * 2. Get their GitHub OAuth access token from the better-auth account table
 * 3. Create/update sync status to "syncing"
 * 4. Schedule the privateRepoSync action with the token
 *
 * The token is passed to the action (which runs server-side only),
 * never exposed to the client.
 */
export const requestPrivateSync = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Verify authentication
    // getAuthUser throws ConvexError("Unauthenticated") instead of returning null
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required. Please sign out and sign back in.");
    }

    // 2. Get the GitHub OAuth access token directly from the component's account table.
    // We query via the component's internal adapter because `auth.api.listUserAccounts`
    // intentionally strips `accessToken` from its response for security.
    const githubAccountDoc = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account" as const,
      where: [
        { field: "userId" as const, value: user._id },
        { field: "providerId" as const, value: "github" },
      ],
    });

    if (!githubAccountDoc?.accessToken) {
      throw new Error(
        "GitHub account not linked or token missing. Please sign out, sign back in with GitHub, and try again."
      );
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new Error("Cannot determine GitHub login. Please sign out and sign back in.");
    }

    // 3. Create or update sync status
    const existingStatus = await ctx.db
      .query("userPrivateSyncStatus")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (existingStatus) {
      if (existingStatus.syncStatus === "syncing") {
        throw new Error("Private repo sync is already in progress");
      }
      await ctx.db.patch(existingStatus._id, {
        syncStatus: "syncing",
        syncError: undefined,
      });
    } else {
      await ctx.db.insert("userPrivateSyncStatus", {
        githubLogin,
        syncStatus: "syncing",
        includesPrivateData: false,
      });
    }

    // 4. Schedule the sync action — runs server-side only
    await ctx.scheduler.runAfter(0, internal.github.privateRepoSync.privateRepoSync, {
      githubLogin,
      githubToken: githubAccountDoc.accessToken,
    });

    return { githubLogin, status: "syncing" };
  },
});
