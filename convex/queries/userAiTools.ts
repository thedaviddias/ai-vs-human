import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Aggregates unique AI tool names from aiConfigs across all repos
 * belonging to a given owner. Returns the distinct tool set and how
 * many repos have at least one AI config.
 */
export const getUserDetectedAiTools = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    const repos = await ctx.db
      .query("repos")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .collect();

    const toolSet = new Set<string>();
    let repoCount = 0;

    for (const repo of repos) {
      if (repo.aiConfigs && repo.aiConfigs.length > 0) {
        repoCount++;
        for (const config of repo.aiConfigs) {
          // Skip skill entries — they're not AI tools
          if (config.tool !== "skills.sh") {
            toolSet.add(config.tool);
          }
        }
      }
    }

    return {
      tools: Array.from(toolSet).sort(),
      repoCount,
    };
  },
});
