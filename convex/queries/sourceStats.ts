import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/authHelpers";

async function requireSourceStatsAccess(ctx: QueryCtx, githubLoginInput: string) {
  const githubLogin = githubLoginInput.toLowerCase();
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
    .unique();

  if (profile?.showSourceStatsPublicly === true) {
    return true;
  }

  let user: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
  try {
    user = await authComponent.getAuthUser(ctx);
  } catch {
    throw new ConvexError("Unauthorized: source stats are private. Please sign in.");
  }

  const requestingLogin = await resolveGitHubLogin(ctx, user);
  if (!requestingLogin || requestingLogin.toLowerCase() !== githubLogin.toLowerCase()) {
    throw new ConvexError("Unauthorized: you do not have permission to view source stats.");
  }

  return true;
}

export const getUserSourceDailyMetric = query({
  args: {
    githubLogin: v.string(),
    sourceId: v.string(),
    metricKey: v.string(),
  },
  handler: async (ctx, args) => {
    const githubLogin = args.githubLogin.toLowerCase();
    await requireSourceStatsAccess(ctx, githubLogin);

    const rows = await ctx.db
      .query("userSourceDailyStats")
      .withIndex("by_login_source", (q) =>
        q.eq("githubLogin", githubLogin).eq("sourceId", args.sourceId)
      )
      .collect();

    return rows
      .map((row) => ({
        date: row.date,
        value: row.metrics[args.metricKey] ?? 0,
      }))
      .sort((a, b) => a.date - b.date);
  },
});

export const getUserSourceSyncStatus = query({
  args: {
    githubLogin: v.string(),
    sourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const githubLogin = args.githubLogin.toLowerCase();
    await requireSourceStatsAccess(ctx, githubLogin);

    return await ctx.db
      .query("userSourceSyncStatus")
      .withIndex("by_login_source", (q) =>
        q.eq("githubLogin", githubLogin).eq("sourceId", args.sourceId)
      )
      .unique();
  },
});
