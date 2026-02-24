import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const upsertProfile = internalMutation({
  args: {
    owner: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.string(),
    followers: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        avatarUrl: args.avatarUrl,
        followers: args.followers,
        lastUpdated: Date.now(),
      });
    } else {
      await ctx.db.insert("profiles", {
        owner: args.owner,
        name: args.name,
        avatarUrl: args.avatarUrl,
        followers: args.followers,
        lastUpdated: Date.now(),
      });
    }
  },
});
