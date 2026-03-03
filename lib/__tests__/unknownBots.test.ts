import { describe, expect, it } from "vitest";
import {
  extractActionableUnknownBotIdentities,
  extractUnknownBotIdentities,
  isUnknownBotKey,
} from "../unknownBots";

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

describe("extractActionableUnknownBotIdentities", () => {
  it("excludes aggregate unknown buckets and keeps actionable bot-* identities", () => {
    const result = extractActionableUnknownBotIdentities([
      { key: "other-bot", label: "Unknown Automation Bot", commits: 8 },
      { key: "bot-unspecified", label: "Unknown Automation Bot", commits: 5 },
      { key: "bot-internal-helper-bot", label: "Internal Helper Bot", commits: 3 },
      { key: "bot-acme-ci", label: "Acme Ci", commits: 2 },
    ]);

    expect(result.map((entry) => entry.key)).toEqual(["bot-internal-helper-bot", "bot-acme-ci"]);
  });

  it("returns empty array when only aggregate unknown buckets exist", () => {
    const result = extractActionableUnknownBotIdentities([
      { key: "other-bot", label: "Unknown Automation Bot", commits: 4 },
      { key: "bot-unspecified", label: "Unknown Automation Bot", commits: 2 },
    ]);

    expect(result).toEqual([]);
  });
});
