/**
 * TDD-style tests for aggregateUserStats.
 *
 * These tests express EXPECTED behavior based on the documented contract,
 * NOT what the code currently does. If a test fails, it's a bug in the code.
 *
 * Key invariants from the docstring:
 * 1. Three-way split: Human, AI Assistants, Automation Bots
 * 2. humanPercentage + aiPercentage + automationPercentage should ≈ 100%
 * 3. LOC percentages should never be NaN
 * 4. Empty input should produce sensible defaults (not NaN, not crashes)
 * 5. Trend calculation should handle < 8 weeks gracefully
 */

import { describe, expect, it } from "vitest";
import type { AggregatedWeek } from "../aggregateUserStats";
import { aggregateMultiRepoStats, computeUserSummary } from "../aggregateUserStats";

// ---------- helpers ----------

function makeWeek(overrides: Partial<AggregatedWeek> & { weekLabel: string }): AggregatedWeek {
  return {
    human: 0,
    dependabot: 0,
    renovate: 0,
    copilot: 0,
    claude: 0,
    cursor: 0,
    aider: 0,
    devin: 0,
    openaiCodex: 0,
    gemini: 0,
    githubActions: 0,
    otherBot: 0,
    aiAssisted: 0,
    total: 0,
    humanAdditions: 0,
    copilotAdditions: 0,
    claudeAdditions: 0,
    cursorAdditions: 0,
    aiderAdditions: 0,
    devinAdditions: 0,
    openaiCodexAdditions: 0,
    geminiAdditions: 0,
    aiAssistedAdditions: 0,
    totalAdditions: 0,
    totalDeletions: 0,
    ...overrides,
  };
}

// ---------- tests ----------

describe("computeUserSummary — edge cases (TDD)", () => {
  it("returns zero percentages for empty input (no NaN)", () => {
    const result = computeUserSummary([]);

    expect(result.aiPercentage).toBe("0");
    expect(result.humanPercentage).toBe("0");
    expect(result.automationPercentage).toBe("0");
    expect(result.trend).toBe(0);
    expect(result.hasLocData).toBe(false);
    expect(result.locBotPercentage).toBeNull();
    expect(result.locHumanPercentage).toBeNull();
    // Ensure no NaN sneaks in
    expect(Number.isNaN(Number(result.aiPercentage))).toBe(false);
    expect(Number.isNaN(Number(result.humanPercentage))).toBe(false);
  });

  it("automation bots are counted separately in totals", () => {
    const weeks = [makeWeek({ weekLabel: "2025-W01", dependabot: 50, renovate: 10, total: 60 })];

    const result = computeUserSummary(weeks);

    // Automation bots now contribute to total (3-way split)
    expect(result.totals.automation).toBe(60);
    expect(result.totals.total).toBe(60);
    expect(result.automationPercentage).toBe("100.0");
    expect(result.aiPercentage).toBe("0");
    expect(result.humanPercentage).toBe("0");
  });

  it("human + AI + automation percentages sum to ~100% for mixed commits", () => {
    const weeks = [
      makeWeek({ weekLabel: "2025-W01", human: 70, copilot: 20, claude: 10, total: 100 }),
    ];

    const result = computeUserSummary(weeks);

    const humanPct = parseFloat(result.humanPercentage);
    const aiPct = parseFloat(result.aiPercentage);
    const automationPct = parseFloat(result.automationPercentage);

    // They should sum to 100 within floating-point rounding
    expect(humanPct + aiPct + automationPct).toBeCloseTo(100, 0);
  });

  it("counts ALL AI tools, not just some (aider, devin, openaiCodex, gemini)", () => {
    const weeks = [
      makeWeek({
        weekLabel: "2025-W01",
        human: 50,
        aider: 10,
        devin: 10,
        openaiCodex: 10,
        gemini: 10,
        copilot: 5,
        claude: 5,
        total: 100,
      }),
    ];

    const result = computeUserSummary(weeks);

    // AI total should be 10+10+10+10+5+5 = 50
    expect(result.totals.ai).toBe(50);
    expect(result.totals.human).toBe(50);
    expect(result.totals.total).toBe(100);
    expect(result.humanPercentage).toBe("50.0");
    expect(result.aiPercentage).toBe("50.0");
  });

  it("LOC percentages handle zero LOC without NaN", () => {
    const weeks = [
      makeWeek({
        weekLabel: "2025-W01",
        human: 10,
        copilot: 5,
        total: 15,
        // No LOC data at all
        humanAdditions: 0,
        copilotAdditions: 0,
        totalAdditions: 0,
      }),
    ];

    const result = computeUserSummary(weeks);

    // Should NOT be NaN
    expect(result.hasLocData).toBe(false);
    expect(result.locBotPercentage).toBeNull();
    expect(result.locHumanPercentage).toBeNull();
  });

  it("LOC AI percentage includes ALL tool additions", () => {
    const weeks = [
      makeWeek({
        weekLabel: "2025-W01",
        human: 10,
        aider: 5,
        devin: 5,
        total: 20,
        humanAdditions: 500,
        aiderAdditions: 200,
        devinAdditions: 300,
        totalAdditions: 1000,
      }),
    ];

    const result = computeUserSummary(weeks);

    // AI LOC = 200 + 300 = 500, Human LOC = 500, total = 1000
    expect(result.hasLocData).toBe(true);
    expect(result.locBotPercentage).toBe("50.0");
    expect(result.locHumanPercentage).toBe("50.0");
  });

  it("trend calculation with exactly 4 weeks (no previous period)", () => {
    const weeks = [
      makeWeek({ weekLabel: "2025-W01", copilot: 10, total: 10 }),
      makeWeek({ weekLabel: "2025-W02", copilot: 20, total: 20 }),
      makeWeek({ weekLabel: "2025-W03", copilot: 30, total: 30 }),
      makeWeek({ weekLabel: "2025-W04", copilot: 40, total: 40 }),
    ];

    const result = computeUserSummary(weeks);

    // With no previous 4 weeks, previousAI = 0, trend should be 0 (not infinity)
    expect(result.trend).toBe(0);
    expect(Number.isFinite(result.trend)).toBe(true);
  });

  it("trend calculation with exactly 1 week", () => {
    const weeks = [makeWeek({ weekLabel: "2025-W01", copilot: 10, total: 10 })];

    const result = computeUserSummary(weeks);

    expect(result.trend).toBe(0);
    expect(Number.isFinite(result.trend)).toBe(true);
  });

  it("trend calculation with 8+ weeks compares last 4 vs previous 4", () => {
    const weeks = Array.from({ length: 8 }, (_, i) =>
      makeWeek({
        weekLabel: `2025-W${String(i + 1).padStart(2, "0")}`,
        copilot: i < 4 ? 10 : 20, // previous: 10 each, recent: 20 each
        total: i < 4 ? 10 : 20,
      })
    );

    const result = computeUserSummary(weeks);

    // Previous 4: 4×10 = 40, Recent 4: 4×20 = 80
    // Trend = ((80-40)/40)*100 = 100%
    expect(result.trend).toBe(100);
  });
});

describe("aggregateMultiRepoStats — edge cases (TDD)", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateMultiRepoStats([])).toEqual([]);
  });

  it("merges weeks with same weekStart from different repos", () => {
    const stats = [
      {
        weekStart: 1000,
        weekLabel: "2025-W01",
        human: 10,
        dependabot: 0,
        renovate: 0,
        copilot: 5,
        claude: 0,
        githubActions: 0,
        otherBot: 0,
        aiAssisted: 0,
        total: 15,
      },
      {
        weekStart: 1000,
        weekLabel: "2025-W01",
        human: 20,
        dependabot: 0,
        renovate: 0,
        copilot: 0,
        claude: 3,
        githubActions: 0,
        otherBot: 0,
        aiAssisted: 0,
        total: 23,
      },
    ];

    const result = aggregateMultiRepoStats(stats);

    expect(result).toHaveLength(1);
    expect(result[0].human).toBe(30);
    expect(result[0].copilot).toBe(5);
    expect(result[0].claude).toBe(3);
    expect(result[0].total).toBe(38);
  });

  it("preserves optional AI tool fields when present", () => {
    const stats = [
      {
        weekStart: 1000,
        weekLabel: "2025-W01",
        human: 10,
        dependabot: 0,
        renovate: 0,
        copilot: 0,
        claude: 0,
        aider: 5,
        devin: 3,
        openaiCodex: 2,
        gemini: 1,
        githubActions: 0,
        otherBot: 0,
        aiAssisted: 0,
        total: 21,
      },
    ];

    const result = aggregateMultiRepoStats(stats);

    expect(result[0].aider).toBe(5);
    expect(result[0].devin).toBe(3);
    expect(result[0].openaiCodex).toBe(2);
    expect(result[0].gemini).toBe(1);
  });

  it("defaults optional fields to 0 when missing", () => {
    const stats = [
      {
        weekStart: 1000,
        weekLabel: "2025-W01",
        human: 10,
        dependabot: 0,
        renovate: 0,
        copilot: 0,
        claude: 0,
        // aider, devin, openaiCodex, gemini deliberately omitted
        githubActions: 0,
        otherBot: 0,
        aiAssisted: 0,
        total: 10,
      },
    ];

    const result = aggregateMultiRepoStats(stats);

    expect(result[0].aider).toBe(0);
    expect(result[0].devin).toBe(0);
    expect(result[0].openaiCodex).toBe(0);
    expect(result[0].gemini).toBe(0);
  });

  it("sorts output by weekStart ascending", () => {
    const stats = [
      {
        weekStart: 3000,
        weekLabel: "2025-W03",
        human: 1,
        dependabot: 0,
        renovate: 0,
        copilot: 0,
        claude: 0,
        githubActions: 0,
        otherBot: 0,
        aiAssisted: 0,
        total: 1,
      },
      {
        weekStart: 1000,
        weekLabel: "2025-W01",
        human: 1,
        dependabot: 0,
        renovate: 0,
        copilot: 0,
        claude: 0,
        githubActions: 0,
        otherBot: 0,
        aiAssisted: 0,
        total: 1,
      },
    ];

    const result = aggregateMultiRepoStats(stats);

    expect(result[0].weekLabel).toBe("2025-W01");
    expect(result[1].weekLabel).toBe("2025-W03");
  });
});
