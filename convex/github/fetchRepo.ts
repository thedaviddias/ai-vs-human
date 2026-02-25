"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

export const fetchRepo = internalAction({
  args: { repoId: v.id("repos"), owner: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await ctx.runMutation(internal.github.ingestRepo.markError, {
        repoId: args.repoId,
        error: "GITHUB_TOKEN not configured",
      });
      return;
    }

    const response = await fetch(`https://api.github.com/repos/${args.owner}/${args.name}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      await ctx.runMutation(internal.github.ingestRepo.markError, {
        repoId: args.repoId,
        error: `GitHub API returned ${response.status}: ${response.statusText}`,
      });
      return;
    }

    const data = await response.json();

    // Fetch user profile to cache followers/display name
    try {
      const userResponse = await fetch(`https://api.github.com/users/${args.owner}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      if (userResponse.ok) {
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
