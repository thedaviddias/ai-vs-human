import type { BotBreakdownEntry } from "./unknownBots";

export function shouldRenderUnknownBotSection(actionableBots: BotBreakdownEntry[]): boolean {
  return actionableBots.length > 0;
}
