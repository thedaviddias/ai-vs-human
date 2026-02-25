import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Resets a repo that is stuck in "syncing" state back to "pending"
 * so the recovery cron can re-queue it for processing.
 *
 * Clears transient sync progress fields (stage, commit count) since
 * the previous run was interrupted and will start fresh.
 */
export const resetStuckRepo = internalMutation({
  args: { repoId: v.id("repos") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.repoId, {
      syncStatus: "pending",
      syncStage: undefined,
      syncCommitsFetched: undefined,
    });
  },
});
