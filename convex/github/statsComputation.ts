/**
 * Pure computation functions for repo stats aggregation.
 *
 * Extracted from the old `recomputeRepoStats` mutation so the logic
 * can run inside an action (which reads commits via paginated queries)
 * without hitting Convex's 16 MB per-transaction read limit.
 *
 * No Convex context required — these are plain JS functions.
 */

import { classificationToField } from "../classification/botDetector";

// ─── Types ──────────────────────────────────────────────────────────────

type Classification =
  | "human"
  | "dependabot"
  | "renovate"
  | "copilot"
  | "claude"
  | "cursor"
  | "aider"
  | "devin"
  | "openai-codex"
  | "gemini"
  | "github-actions"
  | "other-bot"
  | "ai-assisted";

/** Minimal commit shape needed for stats computation. */
export interface CommitForStats {
  authoredAt: number;
  classification: string;
  additions?: number;
  deletions?: number;
  authorLogin?: string;
  authorEmail?: string;
  authorName?: string;
}

export interface WeeklyStatEntry {
  weekStart: number;
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

export interface DailyStatEntry {
  date: number;
  human: number;
  ai: number;
  automation: number;
  humanAdditions: number;
  aiAdditions: number;
  automationAdditions: number;
}

export interface ContributorStatEntry {
  login?: string;
  name?: string;
  email?: string;
  classification: string;
  commitCount: number;
  additions: number;
  deletions: number;
  firstCommitAt: number;
  lastCommitAt: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getDayStart(epochMs: number): number {
  const d = new Date(epochMs);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function getWeekStart(epochMs: number): number {
  const date = new Date(epochMs);
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

function formatWeekLabel(weekStartMs: number): string {
  const date = new Date(weekStartMs);
  const day = date.getUTCDay();
  const thursdayOffset = day === 0 ? -3 : 4 - day;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + thursdayOffset);

  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay();
  const startOfIsoYear = new Date(jan4);
  startOfIsoYear.setUTCDate(jan4.getUTCDate() - (jan4Day === 0 ? 6 : jan4Day - 1));

  const diffMs = thursday.getTime() - startOfIsoYear.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

interface WeekBucket {
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

function emptyBucket(): WeekBucket {
  return {
    human: 0,
    dependabot: 0,
    renovate: 0,
    copilot: 0,
    claude: 0,
    cursor: 0,
    aider: 0,
    devin: 0,
    openaiCodex: 0,
    gemini: 0,
    githubActions: 0,
    otherBot: 0,
    aiAssisted: 0,
    total: 0,
    humanAdditions: 0,
    copilotAdditions: 0,
    claudeAdditions: 0,
    cursorAdditions: 0,
    aiderAdditions: 0,
    devinAdditions: 0,
    openaiCodexAdditions: 0,
    geminiAdditions: 0,
    aiAssistedAdditions: 0,
    totalAdditions: 0,
    totalDeletions: 0,
  };
}

const AI_TOOL_CLASSIFICATIONS = new Set([
  "copilot",
  "claude",
  "cursor",
  "aider",
  "devin",
  "openai-codex",
  "gemini",
  "ai-assisted",
]);

// ─── Main computation ───────────────────────────────────────────────────

export function computeStatsFromCommits(commits: CommitForStats[]): {
  weeklyStats: WeeklyStatEntry[];
  dailyStats: DailyStatEntry[];
  contributorStats: ContributorStatEntry[];
} {
  const weekBuckets = new Map<number, WeekBucket>();
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

  for (const commit of commits) {
    const weekStart = getWeekStart(commit.authoredAt);
    if (!weekBuckets.has(weekStart)) {
      weekBuckets.set(weekStart, emptyBucket());
    }
    const bucket = weekBuckets.get(weekStart)!;
    const field = classificationToField(
      commit.classification as Classification
    ) as keyof WeekBucket;
    (bucket[field] as number)++;
    bucket.total++;

    const adds = commit.additions ?? 0;
    const dels = commit.deletions ?? 0;
    switch (commit.classification) {
      case "human":
        bucket.humanAdditions += adds;
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
      case "copilot":
        bucket.copilotAdditions += adds;
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
      case "claude":
        bucket.claudeAdditions += adds;
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
      case "cursor":
        bucket.cursorAdditions += adds;
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
      case "aider":
        bucket.aiderAdditions += adds;
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
      case "devin":
        bucket.devinAdditions += adds;
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
      case "openai-codex":
        bucket.openaiCodexAdditions += adds;
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
      case "gemini":
        bucket.geminiAdditions += adds;
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
      case "ai-assisted":
        bucket.aiAssistedAdditions += adds;
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
      default:
        bucket.totalAdditions += adds;
        bucket.totalDeletions += dels;
        break;
    }

    // Daily bucketing — 3-way split: human / AI / automation
    const dayStart = getDayStart(commit.authoredAt);
    const dayBucket = dayBuckets.get(dayStart) ?? {
      human: 0,
      ai: 0,
      automation: 0,
      humanAdditions: 0,
      aiAdditions: 0,
      automationAdditions: 0,
    };

    if (commit.classification === "human") {
      dayBucket.human++;
      dayBucket.humanAdditions += adds;
    } else if (AI_TOOL_CLASSIFICATIONS.has(commit.classification)) {
      dayBucket.ai++;
      dayBucket.aiAdditions += adds;
    } else {
      dayBucket.automation++;
      dayBucket.automationAdditions += adds;
    }
    dayBuckets.set(dayStart, dayBucket);
  }

  // Build weekly stats array
  const weeklyStats: WeeklyStatEntry[] = [];
  for (const [weekStart, counts] of weekBuckets) {
    weeklyStats.push({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      ...counts,
    });
  }

  // Build daily stats array
  const dailyStats: DailyStatEntry[] = [];
  for (const [date, counts] of dayBuckets) {
    dailyStats.push({ date, ...counts });
  }

  // Build contributor stats
  const contributorMap = new Map<
    string,
    {
      login?: string;
      name?: string;
      email?: string;
      classificationCounts: Map<string, number>;
      commitCount: number;
      additions: number;
      deletions: number;
      firstCommitAt: number;
      lastCommitAt: number;
    }
  >();

  for (const commit of commits) {
    const key = commit.authorLogin ?? commit.authorEmail ?? commit.authorName ?? "unknown";
    const existing = contributorMap.get(key);
    if (existing) {
      existing.commitCount++;
      existing.additions += commit.additions ?? 0;
      existing.deletions += commit.deletions ?? 0;
      existing.firstCommitAt = Math.min(existing.firstCommitAt, commit.authoredAt);
      existing.lastCommitAt = Math.max(existing.lastCommitAt, commit.authoredAt);
      existing.classificationCounts.set(
        commit.classification,
        (existing.classificationCounts.get(commit.classification) ?? 0) + 1
      );
    } else {
      const counts = new Map<string, number>();
      counts.set(commit.classification, 1);
      contributorMap.set(key, {
        login: commit.authorLogin ?? undefined,
        name: commit.authorName ?? undefined,
        email: commit.authorEmail ?? undefined,
        classificationCounts: counts,
        commitCount: 1,
        additions: commit.additions ?? 0,
        deletions: commit.deletions ?? 0,
        firstCommitAt: commit.authoredAt,
        lastCommitAt: commit.authoredAt,
      });
    }
  }

  const contributorStats: ContributorStatEntry[] = [];
  for (const contrib of contributorMap.values()) {
    let bestClassification = "human";
    let bestCount = 0;
    for (const [cls, count] of contrib.classificationCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestClassification = cls;
      }
    }
    contributorStats.push({
      login: contrib.login,
      name: contrib.name,
      email: contrib.email,
      classification: bestClassification,
      commitCount: contrib.commitCount,
      additions: contrib.additions,
      deletions: contrib.deletions,
      firstCommitAt: contrib.firstCommitAt,
      lastCommitAt: contrib.lastCommitAt,
    });
  }

  return { weeklyStats, dailyStats, contributorStats };
}
