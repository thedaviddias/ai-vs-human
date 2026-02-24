import { v } from "convex/values";
import { query } from "../_generated/server";

export const getContributorBreakdown = query({
  args: { repoFullName: v.string() },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", args.repoFullName))
      .unique();

    if (!repo) return [];

    const contributors = await ctx.db
      .query("repoContributorStats")
      .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
      .collect();

    return contributors.sort((a, b) => b.commitCount - a.commitCount);
  },
});
