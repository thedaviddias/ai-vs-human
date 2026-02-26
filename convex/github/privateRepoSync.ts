"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import type { CommitPayload } from "../classification/botDetector";
import { classifyCommit } from "../classification/botDetector";
import type { CommitForStats } from "./statsComputation";
import { computeStatsFromCommits } from "./statsComputation";

const PER_PAGE = 100;
const MAX_REPOS = 200; // safety limit
const INTER_PAGE_DELAY_MS = 200; // gentle rate-limit pacing
const INTER_REPO_DELAY_MS = 300;

/**
 * Fetches the last 2 years of commits from ALL private repos for a user,
 * classifies them entirely IN MEMORY, then writes ONLY aggregate stats
 * to `userPrivateDailyStats` and `userPrivateWeeklyStats`.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  PRIVACY INVARIANT:                                             │
 * │  - NO repo names are stored anywhere                            │
 * │  - NO commit messages are stored                                │
 * │  - NO commit SHAs are stored                                    │
 * │  - NO file paths are stored                                     │
 * │  - Raw GitHub API responses are used transiently in memory only │
 * │  - Only aggregate numbers (human/AI/bot counts) are persisted   │
 * └─────────────────────────────────────────────────────────────────┘
 */
export const privateRepoSync = internalAction({
  args: {
    githubLogin: v.string(),
    githubToken: v.string(),
  },
  handler: async (ctx, { githubLogin, githubToken }) => {
    try {
      // 1. Fetch list of private repos
      const repos = await fetchPrivateRepos(githubToken);

      if (repos.length === 0) {
        await ctx.runMutation(internal.github.ingestPrivateStats.markPrivateSyncError, {
          githubLogin,
          error: "No private repositories found",
        });
        return;
      }

      // Report initial progress: we know how many repos to process
      await ctx.runMutation(internal.github.ingestPrivateStats.updatePrivateSyncProgress, {
        githubLogin,
        totalRepos: repos.length,
        processedRepos: 0,
        totalCommitsFound: 0,
      });

      // 2. For each private repo, fetch commits and classify IN MEMORY.
      //    We accumulate commits AND report progress after each repo,
      //    so the frontend sees live "Repo 3/12 — 847 commits" updates.
      const allCommits: CommitForStats[] = [];
      const since = getSinceDate();
      let processedRepos = 0;

      for (const repo of repos) {
        const repoCommits = await fetchAllCommitsForRepo(githubToken, repo.full_name, since);

        // Classify each commit IN MEMORY — nothing is persisted
        for (const rawCommit of repoCommits) {
          const { classification, coAuthors: _ } = classifyCommit(rawCommit);

          allCommits.push({
            authoredAt: new Date(
              rawCommit.commit.author?.date ?? rawCommit.commit.committer?.date ?? ""
            ).getTime(),
            classification,
            // LOC data from the list endpoint is not available, so additions/deletions
            // remain undefined — computeStatsFromCommits handles this gracefully (defaults to 0)
            authorLogin: rawCommit.author?.login,
            authorEmail: rawCommit.commit.author?.email,
            authorName: rawCommit.commit.author?.name,
          });
        }

        processedRepos++;

        // Report progress after each repo so the UI updates in real time.
        // We throttle to every 3 repos for efficiency (avoids excessive mutation calls).
        if (processedRepos % 3 === 0 || processedRepos === repos.length) {
          await ctx.runMutation(internal.github.ingestPrivateStats.updatePrivateSyncProgress, {
            githubLogin,
            totalRepos: repos.length,
            processedRepos,
            totalCommitsFound: allCommits.length,
          });
        }

        // Gentle delay between repos to avoid rate limits
        await sleep(INTER_REPO_DELAY_MS);
      }

      // 3. Compute aggregated stats using the SAME pure functions
      //    as the public pipeline — reuse is key for consistency
      const { weeklyStats, dailyStats } = computeStatsFromCommits(allCommits);

      // 4. Write daily stats — the frontend's reactive query will pick these up
      //    immediately, so the heatmap updates as soon as data is written.
      const DAILY_BATCH_SIZE = 500;
      for (let i = 0; i < dailyStats.length; i += DAILY_BATCH_SIZE) {
        const batch = dailyStats.slice(i, i + DAILY_BATCH_SIZE);
        await ctx.runMutation(internal.github.ingestPrivateStats.replacePrivateDailyStats, {
          githubLogin,
          dailyStats: batch,
        });
      }

      // 5. Write weekly stats
      const WEEKLY_BATCH_SIZE = 200;
      for (let i = 0; i < weeklyStats.length; i += WEEKLY_BATCH_SIZE) {
        const batch = weeklyStats.slice(i, i + WEEKLY_BATCH_SIZE);
        if (i === 0) {
          await ctx.runMutation(internal.github.ingestPrivateStats.replacePrivateWeeklyStats, {
            githubLogin,
            weeklyStats: batch,
          });
        } else {
          await ctx.runMutation(internal.github.ingestPrivateStats.replacePrivateWeeklyStats, {
            githubLogin,
            weeklyStats: batch,
          });
        }
      }

      // 6. Mark sync as complete (clears progress fields)
      await ctx.runMutation(internal.github.ingestPrivateStats.markPrivateSyncComplete, {
        githubLogin,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error during private sync";
      await ctx.runMutation(internal.github.ingestPrivateStats.markPrivateSyncError, {
        githubLogin,
        error: message,
      });
    }
  },
});

// ─── Helpers (all transient, nothing persisted) ─────────────────

function getSinceDate(): string {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  return twoYearsAgo.toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GitHubRepo {
  full_name: string;
  private: boolean;
}

/**
 * Fetches ALL private repos for the authenticated user.
 * Uses the user's OAuth token (not the shared GITHUB_TOKEN).
 */
async function fetchPrivateRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (repos.length < MAX_REPOS) {
    const url = `https://api.github.com/user/repos?type=private&per_page=${PER_PAGE}&page=${page}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("GitHub token expired or revoked. Please sign in again.");
      }
      throw new Error(`Failed to fetch private repos: ${response.status}`);
    }

    await handleRateLimit(response);

    const batch: GitHubRepo[] = await response.json();
    if (batch.length === 0) break;

    // Only include genuinely private repos (safety filter)
    for (const repo of batch) {
      if (repo.private) {
        repos.push(repo);
      }
    }

    if (batch.length < PER_PAGE) break;
    page++;
    await sleep(INTER_PAGE_DELAY_MS);
  }

  return repos;
}

/**
 * Fetches ALL commits for a single repo (paginated).
 * Returns raw CommitPayload objects for in-memory classification.
 *
 * IMPORTANT: These are held only in memory and never written to any database.
 */
async function fetchAllCommitsForRepo(
  token: string,
  repoFullName: string,
  since: string
): Promise<CommitPayload[]> {
  const commits: CommitPayload[] = [];
  let page = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `https://api.github.com/repos/${repoFullName}/commits?per_page=${PER_PAGE}&page=${page}&since=${since}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    // Private repo might be a fork where the user lost access, etc.
    if (response.status === 404 || response.status === 409) {
      break;
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("GitHub token expired or revoked");
      }
      // Skip repos that fail with other errors
      break;
    }

    await handleRateLimit(response);

    const batch: CommitPayload[] = await response.json();
    if (batch.length === 0) break;

    commits.push(...batch);

    if (batch.length < PER_PAGE) break;
    page++;
    await sleep(INTER_PAGE_DELAY_MS);
  }

  return commits;
}

/**
 * Checks rate limit headers and waits if necessary.
 */
async function handleRateLimit(response: Response): Promise<void> {
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const resetTime = response.headers.get("X-RateLimit-Reset");

  if (remaining && parseInt(remaining, 10) < 10 && resetTime) {
    const resetMs = parseInt(resetTime, 10) * 1000;
    const waitMs = Math.max(0, resetMs - Date.now()) + 1000;
    // Cap wait to 5 minutes — if longer, just continue and let it fail
    if (waitMs < 300_000) {
      await sleep(waitMs);
    }
  }
}
