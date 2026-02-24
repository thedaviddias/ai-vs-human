import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { hasValidAnalyzeApiKey } from "../lib/analyzeApiKey";

export const requestUserAnalysis = mutation({
  args: {
    repos: v.array(v.object({ owner: v.string(), name: v.string() })),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!hasValidAnalyzeApiKey(args.apiKey)) {
      throw new Error("Unauthorized request");
    }

    const limitedRepos = args.repos.slice(0, 20);
    const results = [];

    for (const repo of limitedRepos) {
      const fullName = `${repo.owner}/${repo.name}`;

      const existing = await ctx.db
        .query("repos")
        .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
        .unique();

      if (existing) {
        // Retry repos stuck in "error" state
        if (existing.syncStatus === "error") {
          await ctx.db.patch(existing._id, {
            syncStatus: "pending",
            syncError: undefined,
          });
        }

        results.push({ fullName, status: existing.syncStatus, existing: true });
        continue;
      }

      await ctx.db.insert("repos", {
        owner: repo.owner,
        name: repo.name,
        fullName,
        defaultBranch: "main",
        githubId: 0,
        syncStatus: "pending",
        requestedAt: Date.now(),
      });

      results.push({ fullName, status: "pending" as const, existing: false });
    }

    // Always ensure at least one pending repo is being processed.
    // This recovers from stale "pending" states where a prior scheduled
    // action failed silently (e.g. during a code deploy).
    const owner = limitedRepos[0]?.owner;
    if (owner) {
      const ownerPending = await ctx.db
        .query("repos")
        .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "pending"))
        .first();

      // Also check nothing is currently syncing for this owner
      const ownerSyncing = await ctx.db
        .query("repos")
        .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "syncing"))
        .first();

      if (ownerPending && !ownerSyncing) {
        await ctx.scheduler.runAfter(0, internal.github.fetchRepo.fetchRepo, {
          repoId: ownerPending._id,
          owner: ownerPending.owner,
          name: ownerPending.name,
        });
      }
    }

    return results;
  },
});
