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
 * Focuses on AI tools only — automation bots (dependabot, renovate,
 * github-actions, other-bot) are excluded from totals and percentages.
 * This gives a cleaner signal: "Of actual code commits, how many involved AI?"
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
      return {
        human: acc.human + (week.human ?? 0),
        ai: acc.ai + aiCommits,
        total: acc.total + (week.human ?? 0) + aiCommits,
      };
    },
    { human: 0, ai: 0, total: 0 }
  );

  const aiPercentage = totals.total > 0 ? formatPercentage((totals.ai / totals.total) * 100) : "0";
  const humanPercentage =
    totals.total > 0 ? formatPercentage((totals.human / totals.total) * 100) : "0";

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
      return {
        humanAdditions: acc.humanAdditions + (week.humanAdditions ?? 0),
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
    botPercentage: aiPercentage,
    humanPercentage,
    trend: Math.round(trend),
    // LOC metrics
    locTotals,
    locBotPercentage: hasLocData
      ? formatPercentage((locTotals.aiAdditions / locTotal) * 100)
      : null,
    locHumanPercentage: hasLocData
      ? formatPercentage((locTotals.humanAdditions / locTotal) * 100)
      : null,
    hasLocData,
  };
}
