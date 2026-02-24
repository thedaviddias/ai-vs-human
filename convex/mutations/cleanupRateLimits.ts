import { internalMutation } from "../_generated/server";

/**
 * Deletes rate limit records older than 7 days.
 *
 * The rateLimits table stores one row per IP per day (format: "2025-01-15").
 * Without cleanup, this grows unbounded. Running daily via cron keeps it small.
 */
export const cleanupRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split("T")[0];

    const allRecords = await ctx.db.query("rateLimits").collect();
    let deleted = 0;

    for (const record of allRecords) {
      if (record.date < cutoffDate) {
        await ctx.db.delete(record._id);
        deleted++;
      }
    }

    return { deleted };
  },
});
