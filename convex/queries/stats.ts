import { v } from "convex/values";
import { query } from "../_generated/server";
import { KNOWN_AI_TOOL_KEYS } from "../classification/detailedBreakdown";

/** AI tool mapping: weekly-stats field → display key/label */
const AI_TOOL_FIELDS = [
  {
    field: "copilot",
    additionsField: "copilotAdditions",
    key: "github-copilot",
    label: "GitHub Copilot",
  },
  { field: "claude", additionsField: "claudeAdditions", key: "claude-code", label: "Claude Code" },
  { field: "cursor", additionsField: "cursorAdditions", key: "cursor", label: "Cursor" },
  { field: "aider", additionsField: "aiderAdditions", key: "aider", label: "Aider" },
  { field: "devin", additionsField: "devinAdditions", key: "devin", label: "Devin" },
  {
    field: "openaiCodex",
    additionsField: "openaiCodexAdditions",
    key: "openai-codex",
    label: "OpenAI Codex",
  },
  { field: "gemini", additionsField: "geminiAdditions", key: "gemini", label: "Gemini" },
  {
    field: "aiAssisted",
    additionsField: "aiAssistedAdditions",
    key: "ai-unspecified",
    label: "Other AI Assisted",
  },
] as const;

const BOT_FIELDS = [
  { field: "dependabot", key: "dependabot", label: "Dependabot" },
  { field: "renovate", key: "renovate", label: "Renovate" },
  { field: "githubActions", key: "github-actions", label: "GitHub Actions" },
  { field: "otherBot", key: "other-bot", label: "Other Bots" },
] as const;

/**
 * Build tool/bot breakdown arrays from weekly stats.
 * Individual commits are deleted after the sync pipeline,
 * so we reconstruct breakdowns from the persisted per-tool fields.
 */
function buildBreakdownFromStats(stats: Array<Record<string, number | string>>) {
  const toolBreakdown: Array<{ key: string; label: string; commits: number; additions: number }> =
    [];
  for (const { field, additionsField, key, label } of AI_TOOL_FIELDS) {
    let commits = 0;
    let additions = 0;
    for (const week of stats) {
      commits += (week[field] as number) ?? 0;
      additions += (week[additionsField] as number) ?? 0;
    }
    if (commits > 0 || additions > 0) {
      toolBreakdown.push({ key, label, commits, additions });
    }
  }

  const botBreakdown: Array<{ key: string; label: string; commits: number }> = [];
  for (const { field, key, label } of BOT_FIELDS) {
    let commits = 0;
    for (const week of stats) {
      commits += (week[field] as number) ?? 0;
    }
    if (commits > 0) {
      botBreakdown.push({ key, label, commits });
    }
  }

  return { toolBreakdown, botBreakdown };
}

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
      {
        human: number;
        ai: number;
        automation: number;
        humanAdditions: number;
        aiAdditions: number;
        automationAdditions: number;
      }
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
          existing.automation += stat.automation ?? 0;
          existing.humanAdditions += stat.humanAdditions;
          existing.aiAdditions += stat.aiAdditions;
          existing.automationAdditions += stat.automationAdditions ?? 0;
        } else {
          dayBuckets.set(stat.date, {
            human: stat.human,
            ai: stat.ai,
            automation: stat.automation ?? 0,
            humanAdditions: stat.humanAdditions,
            aiAdditions: stat.aiAdditions,
            automationAdditions: stat.automationAdditions ?? 0,
          });
        }
      }
    }

    return Array.from(dayBuckets.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date - b.date);
  },
});

export const getMultiRepoDetailedBreakdown = query({
  args: { repoFullNames: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Merge persisted breakdowns from each repo.
    // Falls back to stats-based approximation for repos synced before this feature.
    const aiMap = new Map<
      string,
      { key: string; label: string; commits: number; additions: number }
    >();
    const botMap = new Map<string, { key: string; label: string; commits: number }>();

    for (const fullName of args.repoFullNames) {
      const repo = await ctx.db
        .query("repos")
        .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
        .unique();
      if (!repo) continue;

      // Get tool breakdown: persisted or fall back to stats-based
      let repoTools = repo.toolBreakdown;
      let repoBots = repo.botBreakdown;
      if (!repoTools) {
        const stats = await ctx.db
          .query("repoWeeklyStats")
          .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
          .collect();
        const fallback = buildBreakdownFromStats(stats as Array<Record<string, number | string>>);
        repoTools = fallback.toolBreakdown;
        repoBots = fallback.botBreakdown;
      }

      for (const tool of filterValidToolBreakdown(repoTools ?? [])) {
        const existing = aiMap.get(tool.key);
        if (existing) {
          existing.commits += tool.commits;
          existing.additions += tool.additions;
        } else {
          aiMap.set(tool.key, { ...tool });
        }
      }

      for (const bot of repoBots ?? []) {
        const existing = botMap.get(bot.key);
        if (existing) {
          existing.commits += bot.commits;
        } else {
          botMap.set(bot.key, { ...bot });
        }
      }
    }

    return {
      toolBreakdown: Array.from(aiMap.values()).sort((a, b) => b.commits - a.commits),
      botBreakdown: Array.from(botMap.values()).sort((a, b) => b.commits - a.commits),
    };
  },
});

/** Strip persisted entries that contain human usernames mistakenly stored as AI tools. */
function filterValidToolBreakdown(
  entries: Array<{ key: string; label: string; commits: number; additions: number }>
): Array<{ key: string; label: string; commits: number; additions: number }> {
  return entries.filter((e) => KNOWN_AI_TOOL_KEYS.has(e.key));
}

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

    // Granular breakdown: prefer persisted data (from sync pipeline),
    // fall back to stats-based approximation for repos synced before this feature.
    // filterValidToolBreakdown strips human usernames that were incorrectly
    // persisted as AI tools before the detailedBreakdown fix.
    const toolBreakdown = filterValidToolBreakdown(
      repo.toolBreakdown ??
        buildBreakdownFromStats(stats as Array<Record<string, number | string>>).toolBreakdown
    );
    const botBreakdown =
      repo.botBreakdown ??
      buildBreakdownFromStats(stats as Array<Record<string, number | string>>).botBreakdown;

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
      botBreakdown,
    };
  },
});
