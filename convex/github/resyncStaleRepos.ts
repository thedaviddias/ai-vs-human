"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { extractRateLimitInfo, getGitHubHeaders, getRetryDelayMs } from "./githubApi";

/** Stagger delay between repos to avoid overwhelming GitHub API. */
const DELAY_PER_REPO_MS = 30_000; // 30 seconds between each repo
/** Maximum repos to resync per cron run to stay within API rate limits. */
const MAX_REPOS_PER_RUN = 25;

export const resyncStaleRepos = internalAction({
  args: {},
  handler: async (ctx) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.log("[resyncStaleRepos] No GITHUB_TOKEN configured, skipping");
      return;
    }

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const repos = await ctx.runQuery(internal.queries.repos.getAllRepos);

    const staleRepos = repos
      .filter(
        (r) => r.syncStatus === "synced" && (r.lastSyncedAt == null || r.lastSyncedAt < oneDayAgo)
      )
      .slice(0, MAX_REPOS_PER_RUN);

    if (staleRepos.length === 0) {
      console.log("[resyncStaleRepos] No stale repos found");
      return;
    }

    // Pre-check which repos have actually changed on GitHub by comparing pushed_at.
    // Each check costs 1 API call but potentially saves 10-50+ calls per skipped repo.
    const changedRepos = [];

    for (const repo of staleRepos) {
      const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
        headers: getGitHubHeaders(token),
      });

      const rateLimitInfo = extractRateLimitInfo(response);
      if (rateLimitInfo.isRateLimited) {
        const delayMs = getRetryDelayMs(rateLimitInfo);
        console.log(
          `[resyncStaleRepos] Rate limited during pre-check after ${changedRepos.length} repos, ` +
            `stopping. Reset in ${Math.round(delayMs / 1000)}s`
        );
        break;
      }

      if (!response.ok) {
        // Skip repos we can't check (404, etc.)
        continue;
      }

      const data = await response.json();
      const remotePushedAt = data.pushed_at ? new Date(data.pushed_at).getTime() : null;

      if (!remotePushedAt || !repo.pushedAt || remotePushedAt > repo.pushedAt) {
        changedRepos.push(repo);
      }

      // Small delay between pre-checks to be respectful
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(
      `[resyncStaleRepos] Pre-check: ${staleRepos.length} stale, ${changedRepos.length} actually changed`
    );

    for (let i = 0; i < changedRepos.length; i++) {
      const repo = changedRepos[i];
      // Stagger each repo sync to avoid thundering herd on GitHub API
      await ctx.scheduler.runAfter(i * DELAY_PER_REPO_MS, internal.github.fetchRepo.fetchRepo, {
        repoId: repo._id,
        owner: repo.owner,
        name: repo.name,
      });
    }
  },
});
