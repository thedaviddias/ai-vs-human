import { v } from "convex/values";
import { internalQuery, query } from "../_generated/server";

export const getRepoBySlug = query({
  args: { owner: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", `${args.owner}/${args.name}`))
      .unique();
  },
});

export const getIndexedRepos = query({
  args: {},
  handler: async (ctx) => {
    const repos = await ctx.db
      .query("repos")
      .withIndex("by_syncStatus", (q) => q.eq("syncStatus", "synced"))
      .collect();

    return repos.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
  },
});

export const getReposByFullNames = query({
  args: { fullNames: v.array(v.string()) },
  handler: async (ctx, args) => {
    const repos = [];
    for (const fullName of args.fullNames) {
      const repo = await ctx.db
        .query("repos")
        .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
        .unique();
      repos.push({ fullName, repo });
    }
    return repos;
  },
});

export const getRepoById = internalQuery({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.repoId);
  },
});

export const getAllRepos = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("repos").collect();
  },
});
