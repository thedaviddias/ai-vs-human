interface WeeklyStatRow {
  weekStart: number;
  weekLabel: string;
  human: number;
  dependabot: number;
  renovate: number;
  copilot: number;
  claude: number;
  cursor?: number;
  aider?: number;
  devin?: number;
  openaiCodex?: number;
  gemini?: number;
  githubActions: number;
  otherBot: number;
  aiAssisted: number;
  total: number;
  // LOC fields (optional — missing for pre-LOC data)
  humanAdditions?: number;
  copilotAdditions?: number;
  claudeAdditions?: number;
  cursorAdditions?: number;
  aiderAdditions?: number;
  devinAdditions?: number;
  openaiCodexAdditions?: number;
  geminiAdditions?: number;
  aiAssistedAdditions?: number;
  totalAdditions?: number;
  totalDeletions?: number;
}

export interface AggregatedWeek {
  weekLabel: string;
  human: number;
  dependabot: number;
  renovate: number;
  copilot: number;
  claude: number;
  cursor: number;
  aider: number;
  devin: number;
  openaiCodex: number;
  gemini: number;
  githubActions: number;
  otherBot: number;
  aiAssisted: number;
  total: number;
  // LOC fields (defaulted to 0 when missing)
  humanAdditions: number;
  copilotAdditions: number;
  claudeAdditions: number;
  cursorAdditions: number;
  aiderAdditions: number;
  devinAdditions: number;
  openaiCodexAdditions: number;
  geminiAdditions: number;
  aiAssistedAdditions: number;
  totalAdditions: number;
  totalDeletions: number;
}

function formatPercentage(value: number): string {
  if (value === 0) return "0";
  if (value < 0.1) {
    const formatted = value.toFixed(2);
    return formatted.endsWith("0") ? value.toFixed(1) : formatted;
  }
  return value.toFixed(1);
}

// ─── Breakdown mapping ──────────────────────────────────────────────────
// Mirrors `AI_TOOL_FIELDS` / `BOT_FIELDS` in `convex/queries/stats.ts`.
// Used to build per-tool / per-bot breakdown arrays from weekly stat rows
// so that private weekly data can be merged into the public detailed breakdown.

const AI_TOOL_FIELDS = [
  {
    field: "copilot",
    additionsField: "copilotAdditions",
    key: "github-copilot",
    label: "GitHub Copilot",
  },
  {
    field: "claude",
    additionsField: "claudeAdditions",
    key: "claude-code",
    label: "Claude Code",
  },
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
  // NOTE: "aiAssisted" is intentionally omitted — it's a generic catch-all
  // that can't be attributed to a specific tool. Those commits are still
  // counted in overall AI percentages via computeUserSummary.
] as const;

const BOT_FIELDS = [
  { field: "dependabot", key: "dependabot", label: "Dependabot" },
  { field: "renovate", key: "renovate", label: "Renovate" },
  { field: "githubActions", key: "github-actions", label: "GitHub Actions" },
  { field: "otherBot", key: "other-bot", label: "Unknown Automation Bot" },
] as const;

/**
 * Builds AI tool and automation bot breakdown arrays from weekly stat rows.
 *
 * Mirrors `buildBreakdownFromStats` in `convex/queries/stats.ts` but typed
 * for the client-side `WeeklyStatRow` shape. Used to build breakdowns from
 * private weekly stats so they can be merged with the server's public
 * detailed breakdown (which includes granular keys like "coderabbit").
 */
export function buildBreakdownFromWeeklyStats(
  stats: Array<Record<string, number | string | undefined>>
): {
  toolBreakdown: Array<{ key: string; label: string; commits: number; additions: number }>;
  botBreakdown: Array<{ key: string; label: string; commits: number }>;
} {
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

/**
 * Merges a server-side detailed breakdown (public repos, granular keys)
 * with a private breakdown (from weekly stats, standard 7 tools + 4 bots).
 *
 * For matching keys, commits/additions are summed.
 * Non-overlapping keys from either source are preserved — this keeps
 * granular public keys (e.g., "coderabbit") alongside private data.
 */
export function mergeDetailedBreakdowns(
  publicBreakdown: {
    toolBreakdown: Array<{ key: string; label: string; commits: number; additions: number }>;
    botBreakdown: Array<{ key: string; label: string; commits: number }>;
  },
  privateBreakdown: {
    toolBreakdown: Array<{ key: string; label: string; commits: number; additions: number }>;
    botBreakdown: Array<{ key: string; label: string; commits: number }>;
  }
): {
  toolBreakdown: Array<{ key: string; label: string; commits: number; additions: number }>;
  botBreakdown: Array<{ key: string; label: string; commits: number }>;
} {
  // Merge tool breakdowns
  const toolMap = new Map(publicBreakdown.toolBreakdown.map((t) => [t.key, { ...t }]));
  for (const tool of privateBreakdown.toolBreakdown) {
    const existing = toolMap.get(tool.key);
    if (existing) {
      existing.commits += tool.commits;
      existing.additions += tool.additions;
    } else {
      toolMap.set(tool.key, { ...tool });
    }
  }

  // Merge bot breakdowns
  const botMap = new Map(publicBreakdown.botBreakdown.map((b) => [b.key, { ...b }]));
  for (const bot of privateBreakdown.botBreakdown) {
    const existing = botMap.get(bot.key);
    if (existing) {
      existing.commits += bot.commits;
    } else {
      botMap.set(bot.key, { ...bot });
    }
  }

  return {
    toolBreakdown: Array.from(toolMap.values()),
    botBreakdown: Array.from(botMap.values()),
  };
}

/**
 * Sums all private daily stats into a single commit count.
 *
 * Used to display the "public + private" breakdown in the profile stats
 * card. Each day contributes human + ai + automation commits.
 */
export function sumPrivateDailyStats(
  stats: Array<{ human: number; ai: number; automation: number }>
): number {
  return stats.reduce((sum, day) => sum + day.human + day.ai + day.automation, 0);
}

/**
 * Merges private weekly stats into public weekly stats.
 *
 * Both share the same `WeeklyStatRow` shape. When a week exists in both,
 * the counts are summed. When a week exists only in private, it's added.
 * Returns the merged array (not yet aggregated — pass through
 * `aggregateMultiRepoStats` afterward for grouping).
 *
 * This is the key function that makes stat cards (Human %, AI %, Bot %)
 * reflect both public AND private data when the user has linked private repos.
 */
export function mergePublicAndPrivateWeeklyStats(
  publicStats: WeeklyStatRow[],
  privateStats: WeeklyStatRow[]
): WeeklyStatRow[] {
  if (!privateStats || privateStats.length === 0) return publicStats;
  if (!publicStats || publicStats.length === 0) return privateStats;

  // Simply concatenate — aggregateMultiRepoStats already groups by weekStart
  // and sums all fields. No need to merge here; let the existing grouping handle it.
  return [...publicStats, ...privateStats];
}

/**
 * Groups weekly stat rows by weekStart and sums all classification fields.
 * Returns sorted by weekStart ascending — ready for chart rendering.
 */
export function aggregateMultiRepoStats(stats: WeeklyStatRow[]): AggregatedWeek[] {
  const buckets = new Map<number, AggregatedWeek & { weekStart: number }>();

  for (const stat of stats) {
    const existing = buckets.get(stat.weekStart);
    if (existing) {
      existing.human += stat.human;
      existing.dependabot += stat.dependabot;
      existing.renovate += stat.renovate;
      existing.copilot += stat.copilot;
      existing.claude += stat.claude;
      existing.cursor += stat.cursor ?? 0;
      existing.aider += stat.aider ?? 0;
      existing.devin += stat.devin ?? 0;
      existing.openaiCodex += stat.openaiCodex ?? 0;
      existing.gemini += stat.gemini ?? 0;
      existing.githubActions += stat.githubActions;
      existing.otherBot += stat.otherBot;
      existing.aiAssisted += stat.aiAssisted;
      existing.total += stat.total;
      // LOC
      existing.humanAdditions += stat.humanAdditions ?? 0;
      existing.copilotAdditions += stat.copilotAdditions ?? 0;
      existing.claudeAdditions += stat.claudeAdditions ?? 0;
      existing.cursorAdditions += stat.cursorAdditions ?? 0;
      existing.aiderAdditions += stat.aiderAdditions ?? 0;
      existing.devinAdditions += stat.devinAdditions ?? 0;
      existing.openaiCodexAdditions += stat.openaiCodexAdditions ?? 0;
      existing.geminiAdditions += stat.geminiAdditions ?? 0;
      existing.aiAssistedAdditions += stat.aiAssistedAdditions ?? 0;
      existing.totalAdditions += stat.totalAdditions ?? 0;
      existing.totalDeletions += stat.totalDeletions ?? 0;
    } else {
      buckets.set(stat.weekStart, {
        weekStart: stat.weekStart,
        weekLabel: stat.weekLabel,
        human: stat.human,
        dependabot: stat.dependabot,
        renovate: stat.renovate,
        copilot: stat.copilot,
        claude: stat.claude,
        cursor: stat.cursor ?? 0,
        aider: stat.aider ?? 0,
        devin: stat.devin ?? 0,
        openaiCodex: stat.openaiCodex ?? 0,
        gemini: stat.gemini ?? 0,
        githubActions: stat.githubActions,
        otherBot: stat.otherBot,
        aiAssisted: stat.aiAssisted,
        total: stat.total,
        // LOC
        humanAdditions: stat.humanAdditions ?? 0,
        copilotAdditions: stat.copilotAdditions ?? 0,
        claudeAdditions: stat.claudeAdditions ?? 0,
        cursorAdditions: stat.cursorAdditions ?? 0,
        aiderAdditions: stat.aiderAdditions ?? 0,
        devinAdditions: stat.devinAdditions ?? 0,
        openaiCodexAdditions: stat.openaiCodexAdditions ?? 0,
        geminiAdditions: stat.geminiAdditions ?? 0,
        aiAssistedAdditions: stat.aiAssistedAdditions ?? 0,
        totalAdditions: stat.totalAdditions ?? 0,
        totalDeletions: stat.totalDeletions ?? 0,
      });
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.weekStart - b.weekStart)
    .map(({ weekStart: _, ...rest }) => rest);
}

/**
 * Computes summary stats from aggregated weekly data.
 *
 * Distinguishes between:
 * - Human: Manual commits
 * - AI: Assistive tools (Copilot, Claude, Cursor, etc.)
 * - Automation: Maintenance bots (Dependabot, Renovate, GitHub Actions, etc.)
 */
export function computeUserSummary(aggregated: AggregatedWeek[]) {
  const totals = aggregated.reduce(
    (acc, week) => {
      const aiCommits =
        (week.aiAssisted ?? 0) +
        (week.copilot ?? 0) +
        (week.claude ?? 0) +
        (week.cursor ?? 0) +
        (week.aider ?? 0) +
        (week.devin ?? 0) +
        (week.openaiCodex ?? 0) +
        (week.gemini ?? 0);

      const automationCommits =
        (week.dependabot ?? 0) +
        (week.renovate ?? 0) +
        (week.githubActions ?? 0) +
        (week.otherBot ?? 0);

      return {
        human: acc.human + (week.human ?? 0),
        ai: acc.ai + aiCommits,
        automation: acc.automation + automationCommits,
        total: acc.total + (week.human ?? 0) + aiCommits + automationCommits,
      };
    },
    { human: 0, ai: 0, automation: 0, total: 0 }
  );

  const aiPercentage = totals.total > 0 ? formatPercentage((totals.ai / totals.total) * 100) : "0";
  const humanPercentage =
    totals.total > 0 ? formatPercentage((totals.human / totals.total) * 100) : "0";
  const automationPercentage =
    totals.total > 0 ? formatPercentage((totals.automation / totals.total) * 100) : "0";

  // Trend: compare last 4 weeks vs previous 4 weeks (AI commits only)
  const recent = aggregated.slice(-4);
  const previous = aggregated.slice(-8, -4);

  const sumAI = (weeks: AggregatedWeek[]) =>
    weeks.reduce(
      (sum, w) =>
        sum +
        (w.aiAssisted ?? 0) +
        (w.copilot ?? 0) +
        (w.claude ?? 0) +
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

  // LOC-based metrics
  const locTotals = aggregated.reduce(
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

      // Note: We don't currently track additions for all bot types separately in the schema
      // but they are included in totalAdditions. For the 3-way breakdown, we treat
      // automation additions as the remainder.
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

  // Per-tool breakdown (reuses same shape as getRepoSummary.toolBreakdown)
  const toolBreakdown = aggregated.reduce(
    (acc, week) => {
      acc.copilot.commits += week.copilot;
      acc.copilot.additions += week.copilotAdditions;
      acc.claude.commits += week.claude;
      acc.claude.additions += week.claudeAdditions;
      acc.cursor.commits += week.cursor;
      acc.cursor.additions += week.cursorAdditions;
      acc.aider.commits += week.aider;
      acc.aider.additions += week.aiderAdditions;
      acc.devin.commits += week.devin;
      acc.devin.additions += week.devinAdditions;
      acc.openaiCodex.commits += week.openaiCodex;
      acc.openaiCodex.additions += week.openaiCodexAdditions;
      acc.gemini.commits += week.gemini;
      acc.gemini.additions += week.geminiAdditions;
      acc.aiAssisted.commits += week.aiAssisted;
      acc.aiAssisted.additions += week.aiAssistedAdditions;
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

  // Per-bot breakdown (reuses same shape as getRepoSummary.botBreakdown)
  const botBreakdown = aggregated.reduce(
    (acc, week) => {
      acc.dependabot.commits += week.dependabot;
      acc.renovate.commits += week.renovate;
      acc.githubActions.commits += week.githubActions;
      acc.otherBot.commits += week.otherBot;
      return acc;
    },
    {
      dependabot: { commits: 0 },
      renovate: { commits: 0 },
      githubActions: { commits: 0 },
      otherBot: { commits: 0 },
    }
  );

  return {
    totals,
    aiPercentage,
    humanPercentage,
    automationPercentage,
    trend: Math.round(trend),
    // LOC metrics
    locTotals,
    locBotPercentage: hasLocData
      ? formatPercentage((locTotals.aiAdditions / locTotals.totalAdditions) * 100)
      : null,
    locHumanPercentage: hasLocData
      ? formatPercentage((locTotals.humanAdditions / locTotals.totalAdditions) * 100)
      : null,
    locAutomationPercentage: hasLocData
      ? formatPercentage((locTotals.automationAdditions / locTotals.totalAdditions) * 100)
      : null,
    hasLocData,
    toolBreakdown,
    botBreakdown,
  };
}
