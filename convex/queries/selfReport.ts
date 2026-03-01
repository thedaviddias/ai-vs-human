import { v } from "convex/values";
import { query } from "../_generated/server";

export const getSelfReport = query({
  args: { githubLogin: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userAiSelfReports")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .unique();
  },
});
