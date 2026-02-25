import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { hasValidAnalyzeApiKey } from "../lib/analyzeApiKey";
import { evaluateResyncThrottle } from "../lib/resyncThrottle";

export const resyncRepo = mutation({
  args: {
    owner: v.string(),
    name: v.string(),
    ipHash: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!hasValidAnalyzeApiKey(args.apiKey)) {
      throw new Error("Unauthorized request");
    }

    const fullName = `${args.owner}/${args.name}`;

    const repo = await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
      .unique();

    if (!repo) {
      return { allowed: false as const, reason: "not_found" as const, retryAfterSeconds: 0 };
    }

    if (repo.syncStatus === "pending" || repo.syncStatus === "syncing") {
      return {
        allowed: false as const,
        reason: "already_in_progress" as const,
        retryAfterSeconds: 0,
      };
    }

    // Rate limit check (per-repo, per-IP)
    const existingThrottle = await ctx.db
      .query("repoResyncRateLimits")
      .withIndex("by_repo_ip", (q) => q.eq("repoFullName", fullName).eq("ipHash", args.ipHash))
      .unique();

    const throttle = evaluateResyncThrottle({
      now: Date.now(),
      state: existingThrottle
        ? {
            lastResyncAt: existingThrottle.lastResyncAt,
            dayKey: existingThrottle.dayKey,
            dayCount: existingThrottle.dayCount,
          }
        : undefined,
    });

    if (!throttle.allowed) {
      return {
        allowed: false as const,
        reason: throttle.reason,
        retryAfterSeconds: throttle.retryAfterSeconds,
      };
    }

    // Update or create rate limit record
    if (existingThrottle) {
      await ctx.db.patch(existingThrottle._id, {
        lastResyncAt: throttle.lastResyncAt,
        dayKey: throttle.dayKey,
        dayCount: throttle.dayCount,
      });
    } else {
      await ctx.db.insert("repoResyncRateLimits", {
        repoFullName: fullName,
        ipHash: args.ipHash,
        lastResyncAt: throttle.lastResyncAt,
        dayKey: throttle.dayKey,
        dayCount: throttle.dayCount,
      });
    }

    // Reset this repo to pending
    await ctx.db.patch(repo._id, {
      syncStatus: "pending",
      syncError: undefined,
      syncStage: undefined,
      syncCommitsFetched: undefined,
    });

    // If no other repo for this owner is currently syncing, start immediately
    const ownerSyncing = await ctx.db
      .query("repos")
      .withIndex("by_owner_syncStatus", (q) =>
        q.eq("owner", args.owner).eq("syncStatus", "syncing")
      )
      .first();

    if (!ownerSyncing) {
      await ctx.scheduler.runAfter(0, internal.github.fetchRepo.fetchRepo, {
        repoId: repo._id,
        owner: repo.owner,
        name: repo.name,
      });
    }

    return { allowed: true as const, reason: null, retryAfterSeconds: 0 };
  },
});
