"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

/** Shape returned by getAllRepos (subset of fields we use). */
interface RepoRow {
  _id: Id<"repos">;
  owner: string;
  name: string;
  fullName: string;
  syncStatus: string;
  pushedAt?: number;
  requestedAt: number;
}

/**
 * Admin-only action that resets all repos for a given owner to "pending"
 * and kicks off the ingestion chain.
 *
 * Intended to be called from the CLI script `scripts/resync-all-users.ts`
 * via `npx convex run`. Bypasses user-facing rate limits.
 *
 * Within-owner queueing is handled by Convex's own `markSynced` →
 * `triggerNextPending` chain — repos process sequentially. We only
 * need to kick the first one.
 */
export const adminResyncOwner = internalAction({
  args: {
    owner: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    owner: string;
    totalRepos: number;
    resetCount: number;
    alreadyPending: number;
    kicked: boolean;
    dryRun: boolean;
  }> => {
    const dryRun = args.dryRun ?? false;

    const allRepos: RepoRow[] = await ctx.runQuery(internal.queries.repos.getAllRepos);
    const ownerRepos = allRepos.filter((r: RepoRow) => r.owner === args.owner);

    if (ownerRepos.length === 0) {
      return {
        owner: args.owner,
        totalRepos: 0,
        resetCount: 0,
        alreadyPending: 0,
        kicked: false,
        dryRun,
      };
    }

    let resetCount = 0;
    let alreadyPending = 0;

    for (const repo of ownerRepos) {
      if (repo.syncStatus === "pending") {
        alreadyPending++;
        continue;
      }

      if (!dryRun) {
        await ctx.runMutation(internal.mutations.resetStuckRepo.resetStuckRepo, {
          repoId: repo._id,
        });
      }
      resetCount++;
    }

    // Kick the first pending repo (most-recently-pushed first).
    // The chain auto-continues via markSynced → triggerNextPending.
    let kicked = false;

    if (!dryRun && (resetCount > 0 || alreadyPending > 0)) {
      const freshRepos: RepoRow[] = await ctx.runQuery(internal.queries.repos.getAllRepos);

      const pending = freshRepos
        .filter((r: RepoRow) => r.owner === args.owner && r.syncStatus === "pending")
        .sort(
          (a: RepoRow, b: RepoRow) => (b.pushedAt ?? b.requestedAt) - (a.pushedAt ?? a.requestedAt)
        );

      const alreadySyncing = freshRepos.find(
        (r: RepoRow) => r.owner === args.owner && r.syncStatus === "syncing"
      );

      if (pending.length > 0 && !alreadySyncing) {
        const first = pending[0];
        await ctx.scheduler.runAfter(0, internal.github.fetchRepo.fetchRepo, {
          repoId: first._id,
          owner: first.owner,
          name: first.name,
        });
        kicked = true;
        console.log(`[adminResyncOwner] Kicked sync for "${args.owner}" → ${first.fullName}`);
      }
    }

    console.log(
      `[adminResyncOwner] ${dryRun ? "[DRY RUN] " : ""}Owner "${args.owner}": ` +
        `${resetCount} reset, ${alreadyPending} already pending, ` +
        `${ownerRepos.length} total repos${kicked ? ", queue started" : ""}`
    );

    return {
      owner: args.owner,
      totalRepos: ownerRepos.length,
      resetCount,
      alreadyPending,
      kicked,
      dryRun,
    };
  },
});
