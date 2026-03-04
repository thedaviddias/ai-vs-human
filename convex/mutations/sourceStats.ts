import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const replaceUserSourceDailySnapshot = mutation({
  args: {
    githubLogin: v.string(),
    sourceId: v.string(),
    schemaVersion: v.number(),
    uploadedAt: v.number(),
    clientVersion: v.string(),
    rows: v.array(
      v.object({
        date: v.number(),
        metrics: v.record(v.string(), v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const githubLogin = args.githubLogin.toLowerCase();
    const existingRows = await ctx.db
      .query("userSourceDailyStats")
      .withIndex("by_login_source", (q) =>
        q.eq("githubLogin", githubLogin).eq("sourceId", args.sourceId)
      )
      .collect();

    for (const row of existingRows) {
      await ctx.db.delete(row._id);
    }

    for (const row of args.rows) {
      await ctx.db.insert("userSourceDailyStats", {
        githubLogin,
        sourceId: args.sourceId,
        schemaVersion: args.schemaVersion,
        date: row.date,
        metrics: row.metrics,
        uploadedAt: args.uploadedAt,
      });
    }

    const existingStatus = await ctx.db
      .query("userSourceSyncStatus")
      .withIndex("by_login_source", (q) =>
        q.eq("githubLogin", githubLogin).eq("sourceId", args.sourceId)
      )
      .unique();

    if (existingStatus) {
      await ctx.db.patch(existingStatus._id, {
        lastSyncedAt: args.uploadedAt,
        rowCount: args.rows.length,
        clientVersion: args.clientVersion,
        schemaVersion: args.schemaVersion,
      });
    } else {
      await ctx.db.insert("userSourceSyncStatus", {
        githubLogin,
        sourceId: args.sourceId,
        lastSyncedAt: args.uploadedAt,
        rowCount: args.rows.length,
        clientVersion: args.clientVersion,
        schemaVersion: args.schemaVersion,
      });
    }

    return {
      sourceId: args.sourceId,
      rowCount: args.rows.length,
      uploadedAt: args.uploadedAt,
    };
  },
});
