"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

/** Stagger delay between repos to avoid overwhelming GitHub API. */
const DELAY_PER_REPO_MS = 10_000; // 10 seconds between each repo
/** Maximum repos to resync per cron run to stay within API rate limits. */
const MAX_REPOS_PER_RUN = 50;

export const resyncStaleRepos = internalAction({
  args: {},
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const repos = await ctx.runQuery(internal.queries.repos.getAllRepos);

    const staleRepos = repos
      .filter(
        (r) => r.syncStatus === "synced" && (r.lastSyncedAt == null || r.lastSyncedAt < oneDayAgo)
      )
      .slice(0, MAX_REPOS_PER_RUN);

    for (let i = 0; i < staleRepos.length; i++) {
      const repo = staleRepos[i];
      // Stagger each repo sync to avoid thundering herd on GitHub API
      await ctx.scheduler.runAfter(i * DELAY_PER_REPO_MS, internal.github.fetchRepo.fetchRepo, {
        repoId: repo._id,
        owner: repo.owner,
        name: repo.name,
      });
    }
  },
});
