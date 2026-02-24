"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

const COMMITS_STATS_QUERY = `
query FetchCommitStats($owner: String!, $name: String!, $since: GitTimestamp!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, since: $since, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              oid
              additions
              deletions
            }
          }
        }
      }
    }
  }
  rateLimit {
    remaining
    resetAt
  }
}
`;

/** Same 2-year lookback window used by fetchCommits.ts */
function getSinceDate(): string {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  return twoYearsAgo.toISOString();
}

interface GraphQLResponse {
  data?: {
    repository?: {
      defaultBranchRef?: {
        target?: {
          history?: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{ oid: string; additions: number; deletions: number }>;
          };
        };
      };
    };
    rateLimit?: { remaining: number; resetAt: string };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Enriches stored commits with additions/deletions via GitHub GraphQL API.
 *
 * Inserted into the pipeline between fetchCommits and classifyPRs:
 *   fetchCommits → fetchCommitStats (GraphQL) → classifyPRs
 *
 * Uses GraphQL because the REST list-commits endpoint doesn't return stats.
 * GraphQL fetches 100 commits per request vs 1 REST call per commit.
 *
 * Best-effort: if GraphQL fails, the pipeline continues to classifyPRs
 * without LOC data. The UI gracefully degrades to commit-count mode.
 */
export const fetchCommitStats = internalAction({
  args: {
    repoId: v.id("repos"),
    owner: v.string(),
    name: v.string(),
    cursor: v.optional(v.string()),
    totalCommits: v.number(),
  },
  handler: async (ctx, args) => {
    /** Transition to classifying_prs stage and schedule classifyPRs */
    const scheduleClassifyPRs = async () => {
      await ctx.runMutation(internal.github.ingestRepo.updateSyncProgress, {
        repoId: args.repoId,
        syncStage: "classifying_prs",
      });
      await ctx.scheduler.runAfter(0, internal.github.classifyPRs.classifyPRs, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        totalCommits: args.totalCommits,
      });
    };

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      // No token — skip enrichment, proceed to PR classification
      await scheduleClassifyPRs();
      return;
    }

    const since = getSinceDate();

    let response: Response;
    try {
      response = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: COMMITS_STATS_QUERY,
          variables: {
            owner: args.owner,
            name: args.name,
            since,
            cursor: args.cursor ?? null,
          },
        }),
      });
    } catch {
      // Network error — skip enrichment
      console.error(
        `[fetchCommitStats] Network error for ${args.owner}/${args.name}, skipping LOC enrichment`
      );
      await scheduleClassifyPRs();
      return;
    }

    if (!response.ok) {
      console.error(
        `[fetchCommitStats] GraphQL returned ${response.status} for ${args.owner}/${args.name}, skipping LOC enrichment`
      );
      await scheduleClassifyPRs();
      return;
    }

    const json: GraphQLResponse = await response.json();

    if (json.errors?.length) {
      console.error(
        `[fetchCommitStats] GraphQL errors for ${args.owner}/${args.name}:`,
        json.errors.map((e) => e.message).join("; ")
      );
      await scheduleClassifyPRs();
      return;
    }

    const history = json.data?.repository?.defaultBranchRef?.target?.history;

    if (!history || history.nodes.length === 0) {
      // No history data — proceed to PR classification
      await scheduleClassifyPRs();
      return;
    }

    // Batch update commits with LOC data
    const updates = history.nodes.map((node) => ({
      sha: node.oid,
      additions: node.additions,
      deletions: node.deletions,
    }));

    await ctx.runMutation(internal.github.ingestCommits.batchUpdateLoc, {
      updates,
    });

    // Handle rate limiting
    const rateLimit = json.data?.rateLimit;
    if (rateLimit && rateLimit.remaining < 10) {
      const resetMs = new Date(rateLimit.resetAt).getTime();
      const delayMs = Math.max(0, resetMs - Date.now()) + 1000;
      if (history.pageInfo.hasNextPage && history.pageInfo.endCursor) {
        await ctx.scheduler.runAfter(delayMs, internal.github.fetchCommitStats.fetchCommitStats, {
          repoId: args.repoId,
          owner: args.owner,
          name: args.name,
          cursor: history.pageInfo.endCursor,
          totalCommits: args.totalCommits,
        });
      } else {
        await scheduleClassifyPRs();
      }
      return;
    }

    // Continue pagination or proceed to classifyPRs
    if (history.pageInfo.hasNextPage && history.pageInfo.endCursor) {
      // Small delay between pages to be respectful
      await ctx.scheduler.runAfter(100, internal.github.fetchCommitStats.fetchCommitStats, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        cursor: history.pageInfo.endCursor,
        totalCommits: args.totalCommits,
      });
    } else {
      // All LOC data enriched — proceed to PR classification
      await scheduleClassifyPRs();
    }
  },
});
