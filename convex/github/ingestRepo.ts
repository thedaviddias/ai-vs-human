import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";

export const updateMetadata = internalMutation({
  args: {
    repoId: v.id("repos"),
    githubId: v.number(),
    description: v.optional(v.string()),
    stars: v.optional(v.number()),
    defaultBranch: v.string(),
    pushedAt: v.optional(v.number()),
    aiConfigs: v.optional(
      v.array(
        v.object({
          tool: v.string(),
          type: v.string(),
          name: v.string(),
        })
      )
    ),
    etag: v.optional(v.string()),
    aiConfigsLastCheckedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.repoId, {
      githubId: args.githubId,
      description: args.description,
      stars: args.stars,
      defaultBranch: args.defaultBranch,
      aiConfigs: args.aiConfigs,
      ...(args.pushedAt !== undefined ? { pushedAt: args.pushedAt } : {}),
      ...(args.etag !== undefined ? { etag: args.etag } : {}),
      ...(args.aiConfigsLastCheckedAt !== undefined
        ? { aiConfigsLastCheckedAt: args.aiConfigsLastCheckedAt }
        : {}),
    });
  },
});

export const setSyncing = internalMutation({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.repoId, {
      syncStatus: "syncing",
      syncStage: "fetching_commits",
      syncCommitsFetched: 0,
    });
  },
});

export const updateSyncProgress = internalMutation({
  args: {
    repoId: v.id("repos"),
    syncStage: v.optional(v.string()),
    syncCommitsFetched: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, string | number | undefined> = {};
    if (args.syncStage !== undefined) patch.syncStage = args.syncStage;
    if (args.syncCommitsFetched !== undefined) patch.syncCommitsFetched = args.syncCommitsFetched;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.repoId, patch);
    }
  },
});

export const markSynced = internalMutation({
  args: { repoId: v.id("repos"), totalCommits: v.number() },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repoId);
    await ctx.db.patch(args.repoId, {
      syncStatus: "synced",
      lastSyncedAt: Date.now(),
      totalCommitsFetched: args.totalCommits,
      syncStage: undefined,
      syncCommitsFetched: undefined,
    });

    // Check for more pending repos and trigger next if any
    let hasMorePending = false;
    if (repo) {
      const pendingRepos = await ctx.db
        .query("repos")
        .withIndex("by_owner_syncStatus", (q) =>
          q.eq("owner", repo.owner).eq("syncStatus", "pending")
        )
        .collect();

      hasMorePending = pendingRepos.length > 0;

      if (hasMorePending) {
        // Sort by pushedAt descending so the most-recently-pushed repo syncs first
        pendingRepos.sort((a, b) => (b.pushedAt ?? b.requestedAt) - (a.pushedAt ?? a.requestedAt));
        await ctx.scheduler.runAfter(0, internal.github.fetchRepo.fetchRepo, {
          repoId: pendingRepos[0]._id,
          owner: pendingRepos[0].owner,
          name: pendingRepos[0].name,
        });
      }
    }

    return { hasMorePending };
  },
});

export const markError = internalMutation({
  args: { repoId: v.id("repos"), error: v.string() },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repoId);
    await ctx.db.patch(args.repoId, {
      syncStatus: "error",
      syncError: args.error,
      syncStage: undefined,
      syncCommitsFetched: undefined,
    });

    // Even on error, move to the next pending repo so the queue doesn't stall
    if (repo) {
      await triggerNextPending(ctx, repo.owner);
    }
  },
});

/**
 * Finds the next repo with syncStatus "pending" for this owner
 * and kicks off its ingestion. This creates a sequential chain:
 * repo1 finishes → triggers repo2 → repo2 finishes → triggers repo3...
 *
 * Repos are processed in "latest first" order (by `pushedAt` descending)
 * so the sync indicator flows top-to-bottom when the user sorts by "Latest".
 */
async function triggerNextPending(ctx: MutationCtx, owner: string) {
  const pendingRepos = await ctx.db
    .query("repos")
    .withIndex("by_owner_syncStatus", (q) => q.eq("owner", owner).eq("syncStatus", "pending"))
    .collect();

  if (pendingRepos.length === 0) return;

  // Sort by pushedAt descending so the most-recently-pushed repo syncs first.
  // Fallback to requestedAt for repos that predate the pushedAt field.
  pendingRepos.sort((a, b) => (b.pushedAt ?? b.requestedAt) - (a.pushedAt ?? a.requestedAt));

  const nextRepo = pendingRepos[0];
  await ctx.scheduler.runAfter(0, internal.github.fetchRepo.fetchRepo, {
    repoId: nextRepo._id,
    owner: nextRepo.owner,
    name: nextRepo.name,
  });
}
