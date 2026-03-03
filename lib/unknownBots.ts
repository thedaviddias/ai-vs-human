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
