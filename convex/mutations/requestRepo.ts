import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation } from "../_generated/server";

export const requestRepo = mutation({
  args: {
    owner: v.string(),
    name: v.string(),
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fullName = `${args.owner}/${args.name}`;

    // Check if repo already exists
    const existing = await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
      .unique();

    if (existing) {
      return { repoId: existing._id, status: existing.syncStatus, existing: true };
    }

    // Rate limit check for user-submitted repos
    if (args.ipHash) {
      const today = new Date().toISOString().split("T")[0];
      const rateLimit = await ctx.db
        .query("rateLimits")
        .withIndex("by_ip_and_date", (q) => q.eq("ipHash", args.ipHash!).eq("date", today))
        .unique();

      if (rateLimit && rateLimit.requestCount >= 5) {
        return {
          repoId: null,
          status: "rate_limited" as const,
          existing: false,
        };
      }

      // Update or create rate limit record
      if (rateLimit) {
        await ctx.db.patch(rateLimit._id, {
          requestCount: rateLimit.requestCount + 1,
        });
      } else {
        await ctx.db.insert("rateLimits", {
          ipHash: args.ipHash!,
          date: today,
          requestCount: 1,
        });
      }
    }

    // Insert new repo with pending status
    const repoId = await ctx.db.insert("repos", {
      owner: args.owner,
      name: args.name,
      fullName,
      defaultBranch: "main",
      githubId: 0,
      syncStatus: "pending",
      requestedAt: Date.now(),
    });

    // Schedule GitHub fetch
    await ctx.scheduler.runAfter(0, internal.github.fetchRepo.fetchRepo, {
      repoId,
      owner: args.owner,
      name: args.name,
    });

    return { repoId, status: "pending" as const, existing: false };
  },
});

// Internal mutation for seeding — skips rate limiting
export const seedRepo = internalMutation({
  args: { owner: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const fullName = `${args.owner}/${args.name}`;

    const existing = await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
      .unique();

    if (existing) return;

    const repoId = await ctx.db.insert("repos", {
      owner: args.owner,
      name: args.name,
      fullName,
      defaultBranch: "main",
      githubId: 0,
      syncStatus: "pending",
      requestedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.github.fetchRepo.fetchRepo, {
      repoId,
      owner: args.owner,
      name: args.name,
    });
  },
});
