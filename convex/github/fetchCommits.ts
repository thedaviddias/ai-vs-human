"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import type { CommitPayload } from "../classification/botDetector";
import { classifyCommit } from "../classification/botDetector";

const PER_PAGE = 100;

// Only fetch commits from the last 2 years
function getSinceDate(): string {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  return twoYearsAgo.toISOString();
}

export const fetchCommits = internalAction({
  args: {
    repoId: v.id("repos"),
    owner: v.string(),
    name: v.string(),
    page: v.number(),
  },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await ctx.runMutation(internal.github.ingestRepo.markError, {
        repoId: args.repoId,
        error: "GITHUB_TOKEN not configured",
      });
      return;
    }

    // Mark as syncing on first page
    if (args.page === 1) {
      await ctx.runMutation(internal.github.ingestRepo.setSyncing, {
        repoId: args.repoId,
      });
    }

    const since = getSinceDate();
    const url = `https://api.github.com/repos/${args.owner}/${args.name}/commits?per_page=${PER_PAGE}&page=${args.page}&since=${since}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    // Handle rate limiting
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const resetTime = response.headers.get("X-RateLimit-Reset");

    if (response.status === 403 && remaining === "0" && resetTime) {
      const resetMs = parseInt(resetTime, 10) * 1000;
      const delayMs = Math.max(0, resetMs - Date.now()) + 1000;
      await ctx.scheduler.runAfter(delayMs, internal.github.fetchCommits.fetchCommits, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        page: args.page,
      });
      return;
    }

    if (!response.ok) {
      await ctx.runMutation(internal.github.ingestRepo.markError, {
        repoId: args.repoId,
        error: `Commits fetch failed: ${response.status} ${response.statusText}`,
      });
      return;
    }

    const commits: CommitPayload[] = await response.json();

    if (commits.length === 0) {
      // No more commits — enrich with LOC data via GraphQL, then PR classification
      await ctx.runMutation(internal.github.ingestRepo.updateSyncProgress, {
        repoId: args.repoId,
        syncStage: "enriching_loc",
      });
      await ctx.scheduler.runAfter(0, internal.github.fetchCommitStats.fetchCommitStats, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        cursor: undefined,
        totalCommits: (args.page - 1) * PER_PAGE,
      });
      return;
    }

    // Classify and transform commits
    const processedCommits = commits.map((commit) => {
      const { classification, coAuthors } = classifyCommit(commit);
      return {
        sha: commit.sha,
        message: commit.commit.message.split("\n")[0],
        fullMessage: commit.commit.message,
        authoredAt: new Date(commit.commit.author?.date ?? Date.now()).getTime(),
        committedAt: new Date(commit.commit.committer?.date ?? Date.now()).getTime(),
        authorName: commit.commit.author?.name ?? undefined,
        authorEmail: commit.commit.author?.email ?? undefined,
        authorGithubUserId: commit.author?.id ?? undefined,
        authorLogin: commit.author?.login ?? undefined,
        authorType: commit.author?.type ?? undefined,
        committerName: commit.commit.committer?.name ?? undefined,
        committerEmail: commit.commit.committer?.email ?? undefined,
        classification,
        coAuthors: coAuthors.length > 0 ? coAuthors : undefined,
      };
    });

    // Batch insert
    await ctx.runMutation(internal.github.ingestCommits.batchInsert, {
      repoId: args.repoId,
      commits: processedCommits,
    });

    // Update sync progress with running commit count
    const commitsSoFar = (args.page - 1) * PER_PAGE + commits.length;
    await ctx.runMutation(internal.github.ingestRepo.updateSyncProgress, {
      repoId: args.repoId,
      syncCommitsFetched: commitsSoFar,
    });

    // Check if there are more pages
    const linkHeader = response.headers.get("Link");
    const hasNextPage = commits.length === PER_PAGE && (linkHeader?.includes('rel="next"') ?? true);

    if (hasNextPage) {
      // Small delay between pages to be respectful to GitHub API
      const delay = remaining && parseInt(remaining, 10) < 100 ? 500 : 100;
      await ctx.scheduler.runAfter(delay, internal.github.fetchCommits.fetchCommits, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        page: args.page + 1,
      });
    } else {
      // Done fetching commits — enrich with LOC data via GraphQL,
      // then PR-level classification, stats recomputation, and finalize.
      await ctx.runMutation(internal.github.ingestRepo.updateSyncProgress, {
        repoId: args.repoId,
        syncStage: "enriching_loc",
      });
      await ctx.scheduler.runAfter(0, internal.github.fetchCommitStats.fetchCommitStats, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        cursor: undefined,
        totalCommits: (args.page - 1) * PER_PAGE + commits.length,
      });
    }
  },
});
