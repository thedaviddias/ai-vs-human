"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { UNKNOWN_AI_KEY } from "../classification/attributionMappings";

/** Stagger delay between repos to avoid overwhelming GitHub API. */
const DELAY_PER_REPO_MS = 10_000; // 10 seconds between each repo

interface ResyncResult {
  dryRun: boolean;
  scheduled: number;
  repos: string[];
  unspecifiedCount: number;
  missingBreakdownCount: number;
  totalCandidates: number;
  estimatedMinutes: number;
}

/**
 * Targeted re-sync for repos affected by classification bugs.
 *
 * Finds repos that either:
 *  - have `ai-unspecified` entries in their persisted `toolBreakdown`
 *  - have no `toolBreakdown` at all (synced before the feature was added)
 *
 * Usage:
 *   npx convex run --prod github/resyncAffectedRepos:resyncAffectedRepos '{}'
 *   npx convex run --prod github/resyncAffectedRepos:resyncAffectedRepos '{"maxRepos": 100}'
 *   npx convex run --prod github/resyncAffectedRepos:resyncAffectedRepos '{"dryRun": true}'
 *   npx convex run --prod github/resyncAffectedRepos:resyncAffectedRepos '{"onlyUnspecified": true}'
 */
export const resyncAffectedRepos = internalAction({
  args: {
    /** Maximum repos to resync in this run (default 50). */
    maxRepos: v.optional(v.number()),
    /** When true, only report what would be resynced without triggering syncs. */
    dryRun: v.optional(v.boolean()),
    /** When true, only resync repos with ai-unspecified entries (skip missing-breakdown repos). */
    onlyUnspecified: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ResyncResult> => {
    const maxRepos = args.maxRepos ?? 50;
    const dryRun = args.dryRun ?? false;
    const onlyUnspecified = args.onlyUnspecified ?? false;

    const allRepos = await ctx.runQuery(internal.queries.repos.getAllRepos);
    const syncedRepos = allRepos.filter((r: { syncStatus: string }) => r.syncStatus === "synced");

    // Category 1: repos with ai-unspecified in their persisted toolBreakdown
    const reposWithUnspecified = syncedRepos.filter(
      (r: { toolBreakdown?: Array<{ key: string }> }) =>
        r.toolBreakdown?.some((t) => t.key === UNKNOWN_AI_KEY)
    );

    // Category 2: repos without any toolBreakdown (synced before the feature)
    const reposWithoutBreakdown = onlyUnspecified
      ? []
      : syncedRepos.filter((r: { toolBreakdown?: unknown }) => !r.toolBreakdown);

    // Combine and deduplicate, prioritizing unspecified repos first
    const seen = new Set<string>();
    const candidates: Array<{ _id: Id<"repos">; fullName: string; owner: string; name: string }> =
      [];

    for (const repo of reposWithUnspecified) {
      if (!seen.has(repo._id)) {
        seen.add(repo._id);
        candidates.push(repo);
      }
    }
    for (const repo of reposWithoutBreakdown) {
      if (!seen.has(repo._id)) {
        seen.add(repo._id);
        candidates.push(repo);
      }
    }

    const toResync = candidates.slice(0, maxRepos);

    if (!dryRun) {
      // Schedule staggered re-syncs
      for (let i = 0; i < toResync.length; i++) {
        const repo = toResync[i];
        await ctx.scheduler.runAfter(i * DELAY_PER_REPO_MS, internal.github.fetchRepo.fetchRepo, {
          repoId: repo._id,
          owner: repo.owner,
          name: repo.name,
        });
      }
    }

    return {
      dryRun,
      scheduled: dryRun ? 0 : toResync.length,
      repos: toResync.map((r) => r.fullName),
      unspecifiedCount: reposWithUnspecified.length,
      missingBreakdownCount: reposWithoutBreakdown.length,
      totalCandidates: candidates.length,
      estimatedMinutes: dryRun ? 0 : Math.ceil((toResync.length * DELAY_PER_REPO_MS) / 60_000),
    };
  },
});
