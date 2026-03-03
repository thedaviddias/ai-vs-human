import { describe, expect, it } from "vitest";
import { extractUnknownBotIdentities, isUnknownBotKey } from "../unknownBots";

describe("extractUnknownBotIdentities", () => {
  it("identifies unknown bot keys correctly", () => {
    expect(isUnknownBotKey("other-bot")).toBe(true);
    expect(isUnknownBotKey("bot-unspecified")).toBe(true);
    expect(isUnknownBotKey("bot-internal-helper")).toBe(true);
    expect(isUnknownBotKey("dependabot")).toBe(false);
    expect(isUnknownBotKey("bot-v1")).toBe(false);
  });

  it("returns empty array when input is missing", () => {
    expect(extractUnknownBotIdentities(undefined)).toEqual([]);
    expect(extractUnknownBotIdentities(null)).toEqual([]);
    expect(extractUnknownBotIdentities([])).toEqual([]);
  });

  it("keeps other-bot and bot-unspecified entries", () => {
    const result = extractUnknownBotIdentities([
      { key: "other-bot", label: "Unknown Automation Bot", commits: 4 },
      { key: "bot-unspecified", label: "Unknown Automation Bot", commits: 2 },
    ]);

    expect(result.map((entry) => entry.key)).toEqual(["other-bot", "bot-unspecified"]);
  });

  it("keeps unresolved bot-* keys and excludes known legacy mapped keys", () => {
    const result = extractUnknownBotIdentities([
      { key: "bot-acme-ci", label: "Acme Ci", commits: 3 },
      { key: "bot-v1", label: "V1", commits: 10 },
      { key: "bot-expo-bot", label: "Expo Bot", commits: 10 },
      { key: "bot-weblate", label: "Weblate", commits: 10 },
      { key: "bot-google-jules", label: "Google Jules", commits: 10 },
    ]);

    expect(result).toEqual([{ key: "bot-acme-ci", label: "Acme Ci", commits: 3 }]);
  });

  it("filters out zero-commit entries and sorts by commits descending", () => {
    const result = extractUnknownBotIdentities([
      { key: "bot-zeta", label: "Zeta", commits: 1 },
      { key: "other-bot", label: "Unknown Automation Bot", commits: 0 },
      { key: "bot-alpha", label: "Alpha", commits: 5 },
    ]);

    expect(result.map((entry) => entry.key)).toEqual(["bot-alpha", "bot-zeta"]);
  });
});
