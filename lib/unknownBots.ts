export interface BotBreakdownEntry {
  key: string;
  label: string;
  commits: number;
}

const RESOLVED_LEGACY_BOT_KEYS = new Set([
  "bot-v1",
  "bot-expo-bot",
  "bot-weblate",
  "bot-google-jules",
]);

export function isUnknownBotKey(key: string): boolean {
  if (key === "other-bot" || key === "bot-unspecified") {
    return true;
  }

  return key.startsWith("bot-") && !RESOLVED_LEGACY_BOT_KEYS.has(key);
}

export function extractUnknownBotIdentities(
  botBreakdown: BotBreakdownEntry[] | null | undefined
): BotBreakdownEntry[] {
  if (!botBreakdown || botBreakdown.length === 0) {
    return [];
  }

  return botBreakdown
    .filter((bot) => bot.commits > 0 && isUnknownBotKey(bot.key))
    .sort((a, b) => b.commits - a.commits || a.label.localeCompare(b.label));
}

/**
 * Actionable unknown bots are unresolved per-identity keys (`bot-*`) that can
 * be turned into explicit mappings in classifier code.
 *
 * Aggregate buckets (`other-bot`, `bot-unspecified`) are intentionally
 * excluded because they don't provide a concrete identity string to map.
 */
export function extractActionableUnknownBotIdentities(
  botBreakdown: BotBreakdownEntry[] | null | undefined
): BotBreakdownEntry[] {
  return extractUnknownBotIdentities(botBreakdown).filter(
    (bot) => bot.key !== "other-bot" && bot.key !== "bot-unspecified"
  );
}
