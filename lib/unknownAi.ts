export interface AiBreakdownEntry {
  key: string;
  label: string;
  commits: number;
  additions: number;
}

export function isUnknownAiKey(key: string): boolean {
  if (key === "ai-unspecified") {
    return true;
  }

  return key.startsWith("ai-");
}

export function extractUnknownAiIdentities(
  toolBreakdown: AiBreakdownEntry[] | null | undefined
): AiBreakdownEntry[] {
  if (!toolBreakdown || toolBreakdown.length === 0) {
    return [];
  }

  return toolBreakdown
    .filter((tool) => (tool.commits > 0 || tool.additions > 0) && isUnknownAiKey(tool.key))
    .sort(
      (a, b) => b.commits - a.commits || b.additions - a.additions || a.label.localeCompare(b.label)
    );
}
