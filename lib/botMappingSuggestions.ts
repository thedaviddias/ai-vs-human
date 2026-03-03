import type { BotBreakdownEntry } from "./unknownBots";

export interface BotMappingSuggestionInput {
  key: string;
  label: string;
}

export interface BotMappingSuggestion {
  inputKey: string;
  inputLabel: string;
  normalizedKey: string;
  regexSource: string;
  detailedBreakdownSnippet: string;
  knownBotsSnippet: string;
  botVisualsSnippet: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordsFromText(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function toFlexiblePattern(words: string[]): string | null {
  if (words.length === 0) return null;
  return words.map((word) => escapeRegex(word)).join("[-_ ]?");
}

function stripBotPrefix(key: string): string {
  return key.startsWith("bot-") ? key.slice(4) : key;
}

function unique(items: Array<string | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function buildBotDetectionRegexSource(input: BotMappingSuggestionInput): string {
  const normalizedKey = stripBotPrefix(input.key);
  const keyPattern = toFlexiblePattern(wordsFromText(normalizedKey));
  const labelPattern = toFlexiblePattern(wordsFromText(input.label));
  const patterns = unique([keyPattern, labelPattern]);
  if (patterns.length > 0) {
    return patterns.join("|");
  }

  const fallback = normalizedKey.trim() || input.label.trim() || "bot";
  return escapeRegex(fallback);
}

export function createBotMappingSuggestion(input: BotMappingSuggestionInput): BotMappingSuggestion {
  const normalizedKey = stripBotPrefix(input.key);
  const regexSource = buildBotDetectionRegexSource(input);

  return {
    inputKey: input.key,
    inputLabel: input.label,
    normalizedKey,
    regexSource,
    detailedBreakdownSnippet: `{ pattern: /${regexSource}/i, match: { key: "${normalizedKey}", label: "${input.label}" } },`,
    knownBotsSnippet: `{ pattern: /${regexSource}/i, classification: "other-bot" },`,
    botVisualsSnippet: `// Optional UI metadata for BotToolBreakdown.tsx\n"${normalizedKey}": "https://example.com", // BOT_URLS\n"${normalizedKey}": "text-neutral-300", // BOT_COLORS`,
  };
}

export function createBotMappingSuggestionFromEntry(
  bot: Pick<BotBreakdownEntry, "key" | "label">
): BotMappingSuggestion {
  return createBotMappingSuggestion({ key: bot.key, label: bot.label });
}
