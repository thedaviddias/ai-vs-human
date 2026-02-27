import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Gets all commits classified as "human" for a repo.
 * Used by the PR classification step to find candidates for reclassification.
 */
export const getHumanCommits = internalQuery({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    const commits = await ctx.db
      .query("commits")
      .withIndex("by_repo_and_classification", (q) =>
        q.eq("repoId", args.repoId).eq("classification", "human")
      )
      .collect();

    return commits.map((c) => ({
      _id: c._id,
      message: c.message,
      fullMessage: c.fullMessage,
    }));
  },
});

/**
 * Gets all cached PR metadata for a repo.
 * Used by classifyPRs to avoid re-fetching PRs from GitHub on resyncs.
 */
export const getCachedPRMetadata = internalQuery({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prMetadata")
      .withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
      .collect();
  },
});

/**
 * Caches PR metadata for a specific PR in a repo.
 * Upserts to avoid duplicates if the PR was already cached.
 */
export const cachePRMetadata = internalMutation({
  args: {
    repoId: v.id("repos"),
    prNumber: v.number(),
    authorLogin: v.string(),
    authorType: v.string(),
    body: v.optional(v.string()),
    branchName: v.optional(v.string()),
    labels: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if this PR is already cached
    const existing = await ctx.db
      .query("prMetadata")
      .withIndex("by_repo_and_pr", (q) => q.eq("repoId", args.repoId).eq("prNumber", args.prNumber))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        authorLogin: args.authorLogin,
        authorType: args.authorType,
        body: args.body,
        branchName: args.branchName,
        labels: args.labels,
        fetchedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("prMetadata", {
        repoId: args.repoId,
        prNumber: args.prNumber,
        authorLogin: args.authorLogin,
        authorType: args.authorType,
        body: args.body,
        branchName: args.branchName,
        labels: args.labels,
        fetchedAt: Date.now(),
      });
    }
  },
});

/**
 * Reclassifies commits based on PR-level analysis.
 * Called after checking PR metadata for bot authors / AI markers.
 */
export const reclassifyCommits = internalMutation({
  args: {
    reclassifications: v.array(
      v.object({
        commitId: v.id("commits"),
        classification: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let updated = 0;
    for (const { commitId, classification } of args.reclassifications) {
      const commit = await ctx.db.get(commitId);
      if (commit && commit.classification === "human") {
        await ctx.db.patch(commitId, {
          classification: classification as
            | "human"
            | "dependabot"
            | "renovate"
            | "copilot"
            | "claude"
            | "cursor"
            | "aider"
            | "devin"
            | "openai-codex"
            | "gemini"
            | "github-actions"
            | "other-bot"
            | "ai-assisted",
        });
        updated++;
      }
    }
    return updated;
  },
});
