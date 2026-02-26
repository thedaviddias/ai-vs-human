import { describe, expect, it } from "vitest";
import { aggregatePrAttribution, mapPrAttributionSignal } from "../prAttribution";

describe("mapPrAttributionSignal", () => {
  it("maps AI review agents to AI lane details", () => {
    const mapped = mapPrAttributionSignal({
      classification: "ai-assisted",
      login: "coderabbitai[bot]",
    });
    expect(mapped).toEqual({
      key: "coderabbit",
      label: "CodeRabbit",
      lane: "ai",
    });
  });

  it("maps known automation classes to automation lane details", () => {
    expect(
      mapPrAttributionSignal({
        classification: "dependabot",
      })
    ).toEqual({
      key: "dependabot",
      label: "Dependabot",
      lane: "automation",
    });
  });

  it("maps other-bot sentry signals to sentry-bot", () => {
    const mapped = mapPrAttributionSignal({
      classification: "other-bot",
      login: "sentry-bot",
    });
    expect(mapped).toEqual({
      key: "sentry-bot",
      label: "Sentry Bot",
      lane: "automation",
    });
  });

  it("falls back to unknown AI for unresolved ai-assisted signals", () => {
    const mapped = mapPrAttributionSignal({
      classification: "ai-assisted",
      body: "automated update",
    });
    expect(mapped).toEqual({
      key: "ai-unspecified",
      label: "Unknown AI Assistant",
      lane: "ai",
    });
  });
});

describe("aggregatePrAttribution", () => {
  it("aggregates totals and per-key breakdown deterministically", () => {
    const result = aggregatePrAttribution(
      [
        { classification: "ai-assisted", login: "coderabbitai", commitCount: 4 },
        { classification: "dependabot", commitCount: 3 },
        { classification: "other-bot", login: "sentry-bot", commitCount: 2 },
        { classification: "human", commitCount: 99 },
      ],
      1_732_800_000_000
    );

    expect(result).toEqual({
      totalCommits: 9,
      aiCommits: 4,
      automationCommits: 5,
      breakdown: [
        { key: "coderabbit", label: "CodeRabbit", lane: "ai", commits: 4 },
        { key: "dependabot", label: "Dependabot", lane: "automation", commits: 3 },
        { key: "sentry-bot", label: "Sentry Bot", lane: "automation", commits: 2 },
      ],
      computedAt: 1_732_800_000_000,
    });
  });

  it("ignores non-positive commit counts", () => {
    const result = aggregatePrAttribution(
      [
        { classification: "copilot", commitCount: 0 },
        { classification: "copilot", commitCount: -1 },
        { classification: "copilot", commitCount: 2 },
      ],
      42
    );
    expect(result.totalCommits).toBe(2);
    expect(result.aiCommits).toBe(2);
    expect(result.automationCommits).toBe(0);
    expect(result.breakdown).toEqual([
      { key: "github-copilot", label: "GitHub Copilot", lane: "ai", commits: 2 },
    ]);
    expect(result.computedAt).toBe(42);
  });
});
