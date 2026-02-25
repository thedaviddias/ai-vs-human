export interface AiToolBreakdownItem {
  key: string;
  label: string;
  commits: number;
  additions: number;
}

export interface BotToolBreakdownItem {
  key: string;
  label: string;
  commits: number;
}

const PINNED_AI_KEYS = [
  "github-copilot",
  "claude-code",
  "cursor",
  "openai-codex",
  "gemini",
  "aider",
  "devin",
  "amazon-q-developer",
  "coderabbit",
  "seer-by-sentry",
  "sentry-ai-reviewer",
  "qodo-merge",
] as const;

const PINNED_BOT_KEYS = ["dependabot", "renovate", "github-actions"] as const;

function getPinnedRank(key: string, pinned: readonly string[]): number {
  const index = pinned.indexOf(key);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function comparePinnedKeys(a: string, b: string, pinned: readonly string[]): number {
  const rankA = getPinnedRank(a, pinned);
  const rankB = getPinnedRank(b, pinned);

  if (rankA === rankB) return 0;
  if (rankA === Number.POSITIVE_INFINITY) return 1;
  if (rankB === Number.POSITIVE_INFINITY) return -1;
  return rankA - rankB;
}

export function sortAiBreakdown(
  items: AiToolBreakdownItem[],
  viewMode: "commits" | "loc"
): AiToolBreakdownItem[] {
  return [...items].sort((a, b) => {
    const pinDelta = comparePinnedKeys(a.key, b.key, PINNED_AI_KEYS);
    if (pinDelta !== 0) return pinDelta;

    const primaryA = viewMode === "loc" ? a.additions : a.commits;
    const primaryB = viewMode === "loc" ? b.additions : b.commits;
    if (primaryA !== primaryB) return primaryB - primaryA;

    const secondaryA = viewMode === "loc" ? a.commits : a.additions;
    const secondaryB = viewMode === "loc" ? b.commits : b.additions;
    if (secondaryA !== secondaryB) return secondaryB - secondaryA;

    return a.label.localeCompare(b.label);
  });
}

export function sortBotBreakdown(items: BotToolBreakdownItem[]): BotToolBreakdownItem[] {
  return [...items].sort((a, b) => {
    const pinDelta = comparePinnedKeys(a.key, b.key, PINNED_BOT_KEYS);
    if (pinDelta !== 0) return pinDelta;

    if (a.commits !== b.commits) return b.commits - a.commits;
    return a.label.localeCompare(b.label);
  });
}
