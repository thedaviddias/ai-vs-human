import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { hasValidAnalyzeApiKey } from "../lib/analyzeApiKey";
import { evaluateResyncThrottle } from "../lib/resyncThrottle";

/**
 * Resets all repos for a given owner back to "pending" status.
 * This causes a full re-sync with the latest classification logic
 * applied to all commits.
 *
 * Also recovers from stuck states — repos stuck in "syncing"
 * from a previously failed operation are reset too.
 *
 * NOTE: This mutation only resets state. The caller is responsible
 * for triggering ingestion afterward (e.g. via requestUserAnalysis).
 * This prevents double-triggering when both resync + analysis run.
 */
export const resyncUser = mutation({
  args: {
    owner: v.string(),
    ipHash: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!hasValidAnalyzeApiKey(args.apiKey)) {
      throw new Error("Unauthorized request");
    }

    const owner = args.owner.toLowerCase();

    const existingThrottle = await ctx.db
      .query("resyncRateLimits")
      .withIndex("by_owner_ip", (q) => q.eq("owner", owner).eq("ipHash", args.ipHash))
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
        retryAfterSeconds: throttle.retryAfterSeconds,
        reason: throttle.reason,
        reset: 0,
      };
    }

    if (existingThrottle) {
      await ctx.db.patch(existingThrottle._id, {
        lastResyncAt: throttle.lastResyncAt,
        dayKey: throttle.dayKey,
        dayCount: throttle.dayCount,
      });
    } else {
      await ctx.db.insert("resyncRateLimits", {
        owner,
        ipHash: args.ipHash,
        lastResyncAt: throttle.lastResyncAt,
        dayKey: throttle.dayKey,
        dayCount: throttle.dayCount,
      });
    }

    // Find all repos for this owner efficiently using the index
    const ownerRepos = await ctx.db
      .query("repos")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();

    if (ownerRepos.length === 0) {
      return {
        allowed: true as const,
        retryAfterSeconds: 0,
        reason: null,
        reset: 0,
      };
    }

    // Reset ALL repos to pending for a full rebuild.
    // Even already-pending repos are flagged to force a full 2-year window.
    let reset = 0;
    for (const repo of ownerRepos) {
      const patch: Record<string, unknown> = {
        forceFullResync: true,
        requestedAt: Date.now(),
      };

      if (repo.syncStatus !== "pending") {
        patch.syncStatus = "pending";
        patch.syncError = undefined;
        patch.syncStage = undefined;
        patch.syncCommitsFetched = undefined;
        reset++;
      }

      await ctx.db.patch(repo._id, patch);

      console.log(
        "[resyncUser] Full rebuild queued",
        JSON.stringify({
          repoId: repo._id,
          fullName: repo.fullName,
          previousStatus: repo.syncStatus,
        })
      );
    }

    return {
      allowed: true as const,
      retryAfterSeconds: 0,
      reason: null,
      reset,
    };
  },
});
