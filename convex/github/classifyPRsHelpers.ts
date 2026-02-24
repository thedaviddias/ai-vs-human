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
