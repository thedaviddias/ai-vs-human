import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { buildTrustedOrigins, resolveGitHubLogin } from "./lib/authHelpers";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    // CSRF protection: browser Origin header must match one of these.
    // Without this, POST to /api/auth/sign-in/social returns 403.
    trustedOrigins: buildTrustedOrigins(siteUrl, process.env.TRUSTED_ORIGINS),
    database: authComponent.adapter(ctx),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        // "repo" scope grants read access to private repos — required for
        // enriching the heatmap with private repo commit activity.
        // The OAuth token is stored in the better-auth account table and
        // used exclusively by the private-repo sync pipeline.
        scope: ["user:email", "repo"],
        // Store GitHub login (e.g., "thedaviddias") in the `username` field.
        // better-auth's default maps `name` to GitHub's display name
        // (e.g., "David Dias"), which differs from the login used in URLs
        // and the `profiles.owner` field. We need the login everywhere.
        mapProfileToUser: (profile) => ({
          username: profile.login,
        }),
      },
    },
    plugins: [convex({ authConfig })],
  });
};

/**
 * Retrieves the authenticated user from the current session.
 * Returns null if no session exists (unauthenticated visitor).
 *
 * Note: `authComponent.getAuthUser` throws `ConvexError("Unauthenticated")`
 * instead of returning null when there's no session. We catch the error
 * so this query degrades gracefully for unauthenticated visitors.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    try {
      return await authComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
  },
});

/**
 * Returns the authenticated user's GitHub login (username).
 *
 * better-auth stores `profile.login` in the `username` field via
 * `mapProfileToUser`. This query exposes it to the client so
 * components can determine `isOwnProfile` by comparing against the
 * URL's `owner` param — rather than using `session.user.name` which
 * contains the GitHub display name (e.g., "David Dias" ≠ "thedaviddias").
 *
 * Returns `null` for unauthenticated visitors.
 */
export const getMyGitHubLogin = query({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      // No session — unauthenticated visitor
      return null;
    }
    return await resolveGitHubLogin(ctx, user);
  },
});
