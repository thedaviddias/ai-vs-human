"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { detectAiConfigs } from "./aiDetection";
import { extractRateLimitInfo, getGitHubHeaders, getRetryDelayMs } from "./githubApi";

const MAX_RETRIES = 3;

export const fetchRepo = internalAction({
  args: {
    repoId: v.id("repos"),
    owner: v.string(),
    name: v.string(),
    retryCount: v.optional(v.number()),
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

    const retryCount = args.retryCount ?? 0;

    // ── Fetch repo metadata ──────────────────────────────────────────
    const repo = await ctx.runQuery(internal.queries.repos.getRepoById, {
      repoId: args.repoId,
    });

    const metadataHeaders: Record<string, string> = {
      ...getGitHubHeaders(token),
    };

    // Use ETag for conditional request if available (304 = free, no rate-limit cost)
    if (repo?.etag) {
      metadataHeaders["If-None-Match"] = repo.etag;
    }

    const response = await fetch(`https://api.github.com/repos/${args.owner}/${args.name}`, {
      headers: metadataHeaders,
    });

    const rateLimitInfo = extractRateLimitInfo(response);

    // Handle rate limiting — schedule retry instead of permanent error
    if (rateLimitInfo.isRateLimited) {
      if (retryCount >= MAX_RETRIES) {
        await ctx.runMutation(internal.github.ingestRepo.markError, {
          repoId: args.repoId,
          error: `Rate limited after ${MAX_RETRIES} retries`,
        });
        return;
      }
      const delayMs = getRetryDelayMs(rateLimitInfo);
      console.log(
        `[fetchRepo] Rate limited for ${args.owner}/${args.name}, retrying in ${Math.round(delayMs / 1000)}s (attempt ${retryCount + 1}/${MAX_RETRIES})`
      );
      await ctx.scheduler.runAfter(delayMs, internal.github.fetchRepo.fetchRepo, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        retryCount: retryCount + 1,
      });
      return;
    }

    // 304 Not Modified — repo hasn't changed, skip metadata update
    if (response.status === 304) {
      console.log(
        `[fetchRepo] ${args.owner}/${args.name} not modified (ETag match), skipping to commits`
      );
      await ctx.scheduler.runAfter(0, internal.github.fetchCommits.fetchCommits, {
        repoId: args.repoId,
        owner: args.owner,
        name: args.name,
        page: 1,
      });
      return;
    }

    if (!response.ok) {
      await ctx.runMutation(internal.github.ingestRepo.markError, {
        repoId: args.repoId,
        error: `GitHub API returned ${response.status}: ${response.statusText}`,
      });
      return;
    }

    const data = await response.json();
    const defaultBranch = data.default_branch;

    // Capture ETag for future conditional requests
    const newEtag = response.headers.get("ETag") ?? undefined;

    // ── Detect AI configs (skip if recently checked) ─────────────────
    let aiConfigs: Array<{ tool: string; type: string; name: string }> = [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const shouldCheckAiConfigs =
      !repo?.aiConfigsLastCheckedAt || repo.aiConfigsLastCheckedAt < sevenDaysAgo;

    if (shouldCheckAiConfigs) {
      try {
        const treeResponse = await fetch(
          `https://api.github.com/repos/${args.owner}/${args.name}/git/trees/${defaultBranch}`,
          { headers: getGitHubHeaders(token) }
        );

        const treeRateLimit = extractRateLimitInfo(treeResponse);
        if (treeRateLimit.isRateLimited) {
          // Abort tree traversal on rate limit — AI configs are non-critical
          console.log(
            `[fetchRepo] Rate limited during tree fetch for ${args.owner}/${args.name}, skipping AI config detection`
          );
        } else if (treeResponse.ok) {
          const treeData = await treeResponse.json();

          const fetchSubTree = async (url: string) => {
            const res = await fetch(url, { headers: getGitHubHeaders(token) });
            if (res.ok) {
              const subData = await res.json();
              return subData.tree;
            }
            return null;
          };

          aiConfigs = await detectAiConfigs(treeData.tree, fetchSubTree);
        }
      } catch (err) {
        console.error("Failed to detect AI configs:", err);
      }
    }

    // ── Fetch user profile (non-critical) ────────────────────────────
    try {
      const userResponse = await fetch(`https://api.github.com/users/${args.owner}`, {
        headers: getGitHubHeaders(token),
      });
      const userRateLimit = extractRateLimitInfo(userResponse);
      if (userRateLimit.isRateLimited) {
        console.log(`[fetchRepo] Rate limited during profile fetch for ${args.owner}, skipping`);
      } else if (userResponse.ok) {
        const userData = await userResponse.json();
        await ctx.runMutation(internal.mutations.profiles.upsertProfile, {
          owner: args.owner,
          name: userData.name ?? undefined,
          avatarUrl: userData.avatar_url,
          followers: userData.followers ?? 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }

    await ctx.runMutation(internal.github.ingestRepo.updateMetadata, {
      repoId: args.repoId,
      githubId: data.id,
      description: data.description ?? undefined,
      stars: data.stargazers_count,
      defaultBranch: data.default_branch,
      pushedAt: data.pushed_at ? new Date(data.pushed_at).getTime() : undefined,
      aiConfigs: aiConfigs.length > 0 ? aiConfigs : undefined,
      etag: newEtag,
      aiConfigsLastCheckedAt: shouldCheckAiConfigs ? Date.now() : undefined,
    });

    // Schedule commit fetching
    await ctx.scheduler.runAfter(0, internal.github.fetchCommits.fetchCommits, {
      repoId: args.repoId,
      owner: args.owner,
      name: args.name,
      page: 1,
    });
  },
});
