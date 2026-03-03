import { describe, expect, it } from "vitest";
import { extractUnknownAiIdentities, isUnknownAiKey } from "../unknownAi";

describe("extractUnknownAiIdentities", () => {
  it("identifies unknown AI keys correctly", () => {
    expect(isUnknownAiKey("ai-unspecified")).toBe(true);
    expect(isUnknownAiKey("ai-internal-assistant")).toBe(true);
    expect(isUnknownAiKey("github-copilot")).toBe(false);
  });

  it("returns empty array when input is missing", () => {
    expect(extractUnknownAiIdentities(undefined)).toEqual([]);
    expect(extractUnknownAiIdentities(null)).toEqual([]);
    expect(extractUnknownAiIdentities([])).toEqual([]);
  });

  it("keeps ai-unspecified and ai-* entries", () => {
    const result = extractUnknownAiIdentities([
      { key: "ai-unspecified", label: "Unknown AI Assistant", commits: 4, additions: 120 },
      { key: "ai-custom-agent", label: "Custom Agent", commits: 2, additions: 80 },
    ]);

    expect(result.map((entry) => entry.key)).toEqual(["ai-unspecified", "ai-custom-agent"]);
  });

  it("filters out non-unknown keys", () => {
    const result = extractUnknownAiIdentities([
      { key: "github-copilot", label: "GitHub Copilot", commits: 10, additions: 1000 },
      { key: "claude-code", label: "Claude Code", commits: 9, additions: 900 },
      { key: "ai-unspecified", label: "Unknown AI Assistant", commits: 1, additions: 10 },
    ]);

    expect(result.map((entry) => entry.key)).toEqual(["ai-unspecified"]);
  });

  it("filters zero rows and sorts by commits, then additions", () => {
    const result = extractUnknownAiIdentities([
      { key: "ai-zeta", label: "Zeta", commits: 1, additions: 25 },
      { key: "ai-alpha", label: "Alpha", commits: 5, additions: 10 },
      { key: "ai-beta", label: "Beta", commits: 5, additions: 50 },
      { key: "ai-empty", label: "Empty", commits: 0, additions: 0 },
    ]);

    expect(result.map((entry) => entry.key)).toEqual(["ai-beta", "ai-alpha", "ai-zeta"]);
  });
});
