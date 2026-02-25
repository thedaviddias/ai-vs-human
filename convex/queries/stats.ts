import { v } from "convex/values";
import { query } from "../_generated/server";

export const getWeeklyStats = query({
  args: { repoFullName: v.string() },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", args.repoFullName))
      .unique();

    if (!repo) return null;

    const stats = await ctx.db
      .query("repoWeeklyStats")
      .withIndex("by_repo_and_week", (q) => q.eq("repoId", repo._id))
      .collect();

    return stats.sort((a, b) => a.weekStart - b.weekStart);
  },
});

export const getMultiRepoWeeklyStats = query({
  args: { repoFullNames: v.array(v.string()) },
  handler: async (ctx, args) => {
    const allStats = [];
    for (const fullName of args.repoFullNames) {
      const repo = await ctx.db
        .query("repos")
        .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
        .unique();
      if (!repo) continue;
      const stats = await ctx.db
        .query("repoWeeklyStats")
        .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
        .collect();
      allStats.push(...stats);
    }
    return allStats;
  },
});

export const getDailyStats = query({
  args: { repoFullName: v.string() },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", args.repoFullName))
      .unique();

    if (!repo) return null;

    const stats = await ctx.db
      .query("repoDailyStats")
      .withIndex("by_repo_and_date", (q) => q.eq("repoId", repo._id))
      .collect();

    return stats.sort((a, b) => a.date - b.date);
  },
});

export const getMultiRepoDailyStats = query({
  args: { repoFullNames: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Aggregate daily stats across multiple repos, merging by date
    const dayBuckets = new Map<
      number,
      { human: number; ai: number; humanAdditions: number; aiAdditions: number }
    >();

    for (const fullName of args.repoFullNames) {
      const repo = await ctx.db
        .query("repos")
        .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
        .unique();
      if (!repo) continue;

      const stats = await ctx.db
        .query("repoDailyStats")
        .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
        .collect();

      for (const stat of stats) {
        const existing = dayBuckets.get(stat.date);
        if (existing) {
          existing.human += stat.human;
          existing.ai += stat.ai;
          existing.humanAdditions += stat.humanAdditions;
          existing.aiAdditions += stat.aiAdditions;
        } else {
          dayBuckets.set(stat.date, {
            human: stat.human,
            ai: stat.ai,
            humanAdditions: stat.humanAdditions,
            aiAdditions: stat.aiAdditions,
          });
        }
      }
    }

    return Array.from(dayBuckets.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date - b.date);
  },
});

function formatPercentage(value: number): string {
  if (value === 0) return "0";
  if (value < 0.1) {
    const formatted = value.toFixed(2);
    return formatted.endsWith("0") ? value.toFixed(1) : formatted;
  }
  return value.toFixed(1);
}

export const getRepoSummary = query({
  args: { repoFullName: v.string() },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", args.repoFullName))
      .unique();

    if (!repo) return null;

    const stats = await ctx.db
      .query("repoWeeklyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
      .collect();

    // 3-way split: Human / AI Assistants / Automation Bots
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

    // Trend: compare last 4 weeks vs previous 4 weeks (AI commits only)
    const sorted = stats.sort((a, b) => b.weekStart - a.weekStart);
    const recent = sorted.slice(0, 4);
    const previous = sorted.slice(4, 8);

    const sumAI = (weeks: typeof stats) =>
      weeks.reduce(
        (sum, w) =>
          sum +
          w.aiAssisted +
          w.copilot +
          w.claude +
          (w.cursor ?? 0) +
          (w.aider ?? 0) +
          (w.devin ?? 0) +
          (w.openaiCodex ?? 0) +
          (w.gemini ?? 0),
        0
      );

    const recentAI = sumAI(recent);
    const previousAI = sumAI(previous);
    const trend = previousAI > 0 ? ((recentAI - previousAI) / previousAI) * 100 : 0;

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
          totalDeletions: acc.totalDeletions + (week.totalDeletions ?? 0),
        };
      },
      { humanAdditions: 0, aiAdditions: 0, totalAdditions: 0, totalDeletions: 0 }
    );

    const locAutomationAdditions = Math.max(
      0,
      locTotals.totalAdditions - locTotals.humanAdditions - locTotals.aiAdditions
    );
    const hasLocData = locTotals.totalAdditions > 0;

    // Individual tool breakdown
    const toolBreakdown = stats.reduce(
      (acc, week) => {
        acc.copilot.commits += week.copilot;
        acc.copilot.additions += week.copilotAdditions ?? 0;
        acc.claude.commits += week.claude;
        acc.claude.additions += week.claudeAdditions ?? 0;
        acc.cursor.commits += week.cursor ?? 0;
        acc.cursor.additions += week.cursorAdditions ?? 0;
        acc.aider.commits += week.aider ?? 0;
        acc.aider.additions += week.aiderAdditions ?? 0;
        acc.devin.commits += week.devin ?? 0;
        acc.devin.additions += week.devinAdditions ?? 0;
        acc.openaiCodex.commits += week.openaiCodex ?? 0;
        acc.openaiCodex.additions += week.openaiCodexAdditions ?? 0;
        acc.gemini.commits += week.gemini ?? 0;
        acc.gemini.additions += week.geminiAdditions ?? 0;
        acc.aiAssisted.commits += week.aiAssisted;
        acc.aiAssisted.additions += week.aiAssistedAdditions ?? 0;
        return acc;
      },
      {
        copilot: { commits: 0, additions: 0 },
        claude: { commits: 0, additions: 0 },
        cursor: { commits: 0, additions: 0 },
        aider: { commits: 0, additions: 0 },
        devin: { commits: 0, additions: 0 },
        openaiCodex: { commits: 0, additions: 0 },
        gemini: { commits: 0, additions: 0 },
        aiAssisted: { commits: 0, additions: 0 },
      }
    );

    return {
      repo,
      totals,
      aiPercentage: totals.total > 0 ? formatPercentage((totals.ai / totals.total) * 100) : "0",
      humanPercentage:
        totals.total > 0 ? formatPercentage((totals.human / totals.total) * 100) : "0",
      automationPercentage:
        totals.total > 0 ? formatPercentage((totals.automation / totals.total) * 100) : "0",
      trend: Math.round(trend),
      weekCount: stats.length,
      // LOC metrics — null when data not yet available (graceful degradation)
      locTotals,
      locAiPercentage: hasLocData
        ? formatPercentage((locTotals.aiAdditions / locTotals.totalAdditions) * 100)
        : null,
      locHumanPercentage: hasLocData
        ? formatPercentage((locTotals.humanAdditions / locTotals.totalAdditions) * 100)
        : null,
      locAutomationPercentage: hasLocData
        ? formatPercentage((locAutomationAdditions / locTotals.totalAdditions) * 100)
        : null,
      hasLocData,
      toolBreakdown,
    };
  },
});
