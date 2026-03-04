import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { DETAILED_BREAKDOWN_VERSION } from "../classification/breakdownVersion";
import { shouldQueueIncrementalRepo } from "../github/syncWindow";
import { hasValidAnalyzeApiKey } from "../lib/analyzeApiKey";

export const requestUserAnalysis = mutation({
  args: {
    repos: v.array(
      v.object({
        owner: v.string(),
        name: v.string(),
        pushedAt: v.optional(v.number()),
      })
    ),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!hasValidAnalyzeApiKey(args.apiKey)) {
      throw new Error("Unauthorized request");
    }

    const limitedRepos = args.repos.slice(0, 20);
    const results = [];

    for (const repo of limitedRepos) {
      const owner = repo.owner.toLowerCase();
      const fullName = `${owner}/${repo.name.toLowerCase()}`;
      const requestedAt = Date.now();

      const existing = await ctx.db
        .query("repos")
        .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
        .unique();

      if (existing) {
        // Incremental mode: queue only changed synced repos, plus repos in error.
        const patch: Record<string, unknown> = {};
        let repoChanged = false;
        let shouldQueue = false;
        let reason:
          | "error_retry"
          | "missing_detailed_breakdown"
          | "changed"
          | "unchanged"
          | "already_pending"
          | "already_syncing"
          | "already_completed" = "already_completed";

        if (existing.syncStatus === "error") {
          shouldQueue = true;
          reason = "error_retry";
        } else if (existing.syncStatus === "synced") {
          repoChanged = shouldQueueIncrementalRepo({
            incomingPushedAt: repo.pushedAt,
            storedPushedAt: existing.pushedAt,
          });
          const hasCurrentDetailedBreakdown =
            existing.detailedBreakdownVersion === DETAILED_BREAKDOWN_VERSION &&
            existing.toolBreakdown !== undefined &&
            existing.botBreakdown !== undefined;
          const needsDetailedBackfill = !hasCurrentDetailedBreakdown;
          shouldQueue = repoChanged || needsDetailedBackfill;
          reason = needsDetailedBackfill
            ? "missing_detailed_breakdown"
            : repoChanged
              ? "changed"
              : "unchanged";
        } else if (existing.syncStatus === "pending") {
          reason = "already_pending";
        } else if (existing.syncStatus === "syncing") {
          reason = "already_syncing";
        }

        if (shouldQueue) {
          patch.syncStatus = "pending";
          patch.syncError = undefined;
          patch.syncStage = undefined;
          patch.syncCommitsFetched = undefined;
          patch.requestedAt = requestedAt;
          patch.forceFullResync = false;
        }

        // Always refresh pushedAt so the sync queue stays in latest-first order
        if (repo.pushedAt !== undefined) {
          patch.pushedAt = repo.pushedAt;
        }

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
        }

        console.log(
          "[requestUserAnalysis] Existing repo decision",
          JSON.stringify({
            fullName,
            syncStatus: existing.syncStatus,
            repoChanged,
            shouldQueue,
            reason,
            incomingPushedAt: repo.pushedAt ?? null,
            storedPushedAt: existing.pushedAt ?? null,
          })
        );

        results.push({
          fullName,
          status: (patch.syncStatus as string | undefined) ?? existing.syncStatus,
          existing: true,
          queued: shouldQueue,
          reason,
        });
        continue;
      }

      await ctx.db.insert("repos", {
        owner,
        name: repo.name,
        fullName,
        defaultBranch: "main",
        githubId: 0,
        syncStatus: "pending",
        requestedAt,
        forceFullResync: false,
        ...(repo.pushedAt !== undefined ? { pushedAt: repo.pushedAt } : {}),
      });

      console.log(
        "[requestUserAnalysis] New repo queued",
        JSON.stringify({
          fullName,
          syncStatus: "pending",
          repoChanged: true,
          incomingPushedAt: repo.pushedAt ?? null,
          storedPushedAt: null,
        })
      );

      results.push({
        fullName,
        status: "pending" as const,
        existing: false,
        queued: true,
        reason: "new_repo" as const,
      });
    }

    // Always ensure at least one pending repo is being processed.
    // This recovers from stale "pending" states where a prior scheduled
    // action failed silently (e.g. during a code deploy).
    const owner = limitedRepos[0]?.owner.toLowerCase();
    if (owner) {
      const ownerPending = await ctx.db
        .query("repos")
        .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "pending"))
        .collect();

      // Also check nothing is currently syncing for this owner
      const ownerSyncing = await ctx.db
        .query("repos")
        .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "syncing"))
        .first();

      if (ownerPending.length > 0 && !ownerSyncing) {
        // Pick the most-recently-pushed repo so sync flows latest-first
        ownerPending.sort((a, b) => (b.pushedAt ?? b.requestedAt) - (a.pushedAt ?? a.requestedAt));
        const firstRepo = ownerPending[0];
        await ctx.scheduler.runAfter(0, internal.github.fetchRepo.fetchRepo, {
          repoId: firstRepo._id,
          owner: firstRepo.owner,
          name: firstRepo.name,
        });
      }
    }

    return results;
  },
});
