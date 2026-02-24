import { query } from "../_generated/server";

export const getGlobalWeeklyStats = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("globalWeeklyStats").withIndex("by_week").collect();

    return stats.sort((a, b) => a.weekStart - b.weekStart);
  },
});

export const getGlobalDailyStats = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("globalDailyStats").withIndex("by_date").collect();

    return stats.sort((a, b) => a.date - b.date);
  },
});

export const getGlobalSummary = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("globalWeeklyStats").collect();

    const repoCount = await ctx.db
      .query("repos")
      .withIndex("by_syncStatus", (q) => q.eq("syncStatus", "synced"))
      .collect();

    // Focus on AI tools only — exclude automation bots from totals.
    // AI = copilot + claude + cursor + aider + devin + openai-codex + gemini + ai-assisted
    // Excluded: dependabot, renovate, github-actions, other-bot
    const totals = stats.reduce(
      (acc, week) => {
        const ai =
          week.aiAssisted +
          week.copilot +
          week.claude +
          (week.cursor ?? 0) +
          (week.aider ?? 0) +
          (week.devin ?? 0) +
          (week.openaiCodex ?? 0) +
          (week.gemini ?? 0);
        return {
          human: acc.human + week.human,
          ai: acc.ai + ai,
          total: acc.total + week.human + ai,
        };
      },
      { human: 0, ai: 0, total: 0 }
    );

    // Trend: compare most recent 4 weeks vs the 4 weeks before that.
    // Keep semantics aligned with homepage totals: AI tools only.
    const sortedByWeek = [...stats].sort((a, b) => b.weekStart - a.weekStart);
    const recent = sortedByWeek.slice(0, 4);
    const previous = sortedByWeek.slice(4, 8);

    const sumAi = (weeks: typeof stats) =>
      weeks.reduce(
        (sum, week) =>
          sum +
          week.aiAssisted +
          week.copilot +
          week.claude +
          (week.cursor ?? 0) +
          (week.aider ?? 0) +
          (week.devin ?? 0) +
          (week.openaiCodex ?? 0) +
          (week.gemini ?? 0),
        0
      );

    const recentAi = sumAi(recent);
    const previousAi = sumAi(previous);
    const trend = previousAi > 0 ? ((recentAi - previousAi) / previousAi) * 100 : 0;

    // LOC-based metrics (additions only, for AI tool categories + human)
    const locTotals = stats.reduce(
      (acc, week) => {
        const aiAdditions =
          (week.aiAssistedAdditions ?? 0) +
          (week.copilotAdditions ?? 0) +
          (week.claudeAdditions ?? 0) +
          (week.cursorAdditions ?? 0) +
          (week.aiderAdditions ?? 0) +
          (week.devinAdditions ?? 0) +
          (week.openaiCodexAdditions ?? 0) +
          (week.geminiAdditions ?? 0);
        const humanAdditions = week.humanAdditions ?? 0;
        return {
          humanAdditions: acc.humanAdditions + humanAdditions,
          aiAdditions: acc.aiAdditions + aiAdditions,
          totalAdditions: acc.totalAdditions + (week.totalAdditions ?? 0),
        };
      },
      { humanAdditions: 0, aiAdditions: 0, totalAdditions: 0 }
    );

    const locTotal = locTotals.humanAdditions + locTotals.aiAdditions;
    const hasLocData = locTotal > 0;

    return {
      totals,
      repoCount: repoCount.length,
      botPercentage: totals.total > 0 ? ((totals.ai / totals.total) * 100).toFixed(1) : "0",
      humanPercentage: totals.total > 0 ? ((totals.human / totals.total) * 100).toFixed(1) : "0",
      trend: Math.round(trend),
      // LOC metrics — null when data not yet available
      locTotals,
      locBotPercentage: hasLocData ? ((locTotals.aiAdditions / locTotal) * 100).toFixed(1) : null,
      locHumanPercentage: hasLocData
        ? ((locTotals.humanAdditions / locTotal) * 100).toFixed(1)
        : null,
      hasLocData,
    };
  },
});
