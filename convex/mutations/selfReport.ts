import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/authHelpers";

const VALID_TOOLS = [
  "copilot",
  "cursor",
  "claude-code",
  "aider",
  "devin",
  "gemini",
  "windsurf",
  "cody",
  "tabnine",
  "other",
] as const;

export const saveSelfReport = mutation({
  args: {
    tools: v.array(v.string()),
    estimatedPercentage: v.optional(v.number()),
  },
  handler: async (ctx, { tools, estimatedPercentage }) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required. Please sign in first.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) {
      throw new Error("Cannot determine GitHub login. Please sign out and sign back in.");
    }

    // Validate tools
    const validTools = tools.filter((t) => (VALID_TOOLS as readonly string[]).includes(t));
    if (validTools.length === 0) {
      throw new Error("At least one valid tool must be selected.");
    }

    // Validate percentage
    if (
      estimatedPercentage !== undefined &&
      (estimatedPercentage < 0 || estimatedPercentage > 100)
    ) {
      throw new Error("Estimated percentage must be between 0 and 100.");
    }

    // Upsert
    const existing = await ctx.db
      .query("userAiSelfReports")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tools: validTools,
        estimatedPercentage,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userAiSelfReports", {
        githubLogin,
        tools: validTools,
        estimatedPercentage,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const deleteSelfReport = mutation({
  args: {},
  handler: async (ctx) => {
    let user: Awaited<ReturnType<typeof authComponent.getAuthUser>>;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required.");
    }

    const githubLogin = await resolveGitHubLogin(ctx, user);
    if (!githubLogin) return { success: false };

    const existing = await ctx.db
      .query("userAiSelfReports")
      .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});
