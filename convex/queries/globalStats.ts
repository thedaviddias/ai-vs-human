import { query } from "../_generated/server";

function formatPercentage(value: number): string {
  if (value === 0) return "0";
  if (value < 0.1) {
    const formatted = value.toFixed(2);
    return formatted.endsWith("0") ? value.toFixed(1) : formatted;
  }
  return value.toFixed(1);
}

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
        const automation = week.dependabot + week.renovate + week.githubActions + week.otherBot;

        return {
          human: acc.human + week.human,
          ai: acc.ai + ai,
          automation: acc.automation + automation,
          total: acc.total + week.human + ai + automation,
        };
      },
      { human: 0, ai: 0, automation: 0, total: 0 }
    );

    // Trend: compare most recent 4 weeks vs the 4 weeks before that.
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

    // LOC-based metrics
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
        const totalAdditions = week.totalAdditions ?? 0;
        const automationAdditions = Math.max(0, totalAdditions - humanAdditions - aiAdditions);

        return {
          humanAdditions: acc.humanAdditions + humanAdditions,
          aiAdditions: acc.aiAdditions + aiAdditions,
          automationAdditions: acc.automationAdditions + automationAdditions,
          totalAdditions: acc.totalAdditions + totalAdditions,
        };
      },
      { humanAdditions: 0, aiAdditions: 0, automationAdditions: 0, totalAdditions: 0 }
    );

    const hasLocData = locTotals.totalAdditions > 0;

    return {
      totals,
      repoCount: repoCount.length,
      humanPercentage:
        totals.total > 0 ? formatPercentage((totals.human / totals.total) * 100) : "0",
      aiPercentage: totals.total > 0 ? formatPercentage((totals.ai / totals.total) * 100) : "0",
      automationPercentage:
        totals.total > 0 ? formatPercentage((totals.automation / totals.total) * 100) : "0",
      trend: Math.round(trend),
      // LOC metrics
      locTotals,
      locHumanPercentage: hasLocData
        ? formatPercentage((locTotals.humanAdditions / locTotals.totalAdditions) * 100)
        : null,
      locAiPercentage: hasLocData
        ? formatPercentage((locTotals.aiAdditions / locTotals.totalAdditions) * 100)
        : null,
      locAutomationPercentage: hasLocData
        ? formatPercentage((locTotals.automationAdditions / locTotals.totalAdditions) * 100)
        : null,
      hasLocData,
    };
  },
});
