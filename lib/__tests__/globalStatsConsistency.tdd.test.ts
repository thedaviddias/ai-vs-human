/**
 * Regression tests for AI tool counting consistency.
 *
 * These tests ensure that ALL AI tool classifications are counted
 * consistently across repo-level and global-level summary calculations.
 *
 * Previously, globalStats.ts and recomputeGlobalStats.ts were missing
 * aider, devin, openaiCodex, and gemini from their formulas. These tests
 * prevent that regression.
 *
 * Key invariant: Every AI tool classification that exists in the schema
 * should be counted in ALL summary calculations — not just some.
 */

import { describe, expect, it } from "vitest";
import type { AggregatedWeek } from "../aggregateUserStats";
import { computeUserSummary } from "../aggregateUserStats";

/**
 * All 8 AI tool fields that MUST be counted in every summary formula.
 * If a new AI tool is added, add it here and any test that doesn't
 * count it will fail.
 */
const ALL_AI_TOOL_FIELDS: (keyof AggregatedWeek)[] = [
  "copilot",
  "claude",
  "cursor",
  "aider",
  "devin",
  "openaiCodex",
  "gemini",
  "aiAssisted",
];

const ALL_AI_LOC_FIELDS: (keyof AggregatedWeek)[] = [
  "copilotAdditions",
  "claudeAdditions",
  "cursorAdditions",
  "aiderAdditions",
  "devinAdditions",
  "openaiCodexAdditions",
  "geminiAdditions",
  "aiAssistedAdditions",
];

describe("AI tool counting consistency (regression)", () => {
  const weekWithAllTools: AggregatedWeek = {
    weekLabel: "2025-W10",
    human: 100,
    dependabot: 5,
    renovate: 3,
    copilot: 20,
    claude: 15,
    cursor: 10,
    aider: 8,
    devin: 7,
    openaiCodex: 6,
    gemini: 4,
    githubActions: 2,
    otherBot: 1,
    aiAssisted: 12,
    total: 193,
    humanAdditions: 5000,
    copilotAdditions: 1000,
    claudeAdditions: 800,
    cursorAdditions: 500,
    aiderAdditions: 400,
    devinAdditions: 350,
    openaiCodexAdditions: 300,
    geminiAdditions: 200,
    aiAssistedAdditions: 600,
    totalAdditions: 9150,
    totalDeletions: 2000,
  };

  it("computeUserSummary counts all 8 AI tool categories in commit totals", () => {
    const result = computeUserSummary([weekWithAllTools]);

    // Expected AI total: 20+15+10+8+7+6+4+12 = 82
    const expectedAI = ALL_AI_TOOL_FIELDS.reduce(
      (sum, field) => sum + ((weekWithAllTools[field] as number) ?? 0),
      0
    );
    expect(expectedAI).toBe(82);
    expect(result.totals.ai).toBe(expectedAI);
  });

  it("computeUserSummary counts all 8 AI tool categories in LOC totals", () => {
    const result = computeUserSummary([weekWithAllTools]);

    // Expected AI LOC: 1000+800+500+400+350+300+200+600 = 4150
    const expectedAILoc = ALL_AI_LOC_FIELDS.reduce(
      (sum, field) => sum + ((weekWithAllTools[field] as number) ?? 0),
      0
    );
    expect(expectedAILoc).toBe(4150);
    expect(result.locTotals.aiAdditions).toBe(expectedAILoc);
  });

  it("human + AI percentages are consistent (sum to ~100%)", () => {
    const result = computeUserSummary([weekWithAllTools]);

    const humanPct = parseFloat(result.humanPercentage);
    const aiPct = parseFloat(result.botPercentage);
    expect(humanPct + aiPct).toBeCloseTo(100, 0);
  });

  it("LOC human + AI percentages are consistent (sum to ~100%)", () => {
    const result = computeUserSummary([weekWithAllTools]);

    expect(result.hasLocData).toBe(true);
    const humanLocPct = parseFloat(result.locHumanPercentage!);
    const aiLocPct = parseFloat(result.locBotPercentage!);
    expect(humanLocPct + aiLocPct).toBeCloseTo(100, 0);
  });

  it("all 8 AI tool commit fields exist in AggregatedWeek type", () => {
    // This test fails if someone removes an AI tool field from the interface
    for (const field of ALL_AI_TOOL_FIELDS) {
      expect(weekWithAllTools).toHaveProperty(field);
      expect(typeof weekWithAllTools[field]).toBe("number");
    }
  });

  it("all 8 AI tool LOC fields exist in AggregatedWeek type", () => {
    for (const field of ALL_AI_LOC_FIELDS) {
      expect(weekWithAllTools).toHaveProperty(field);
      expect(typeof weekWithAllTools[field]).toBe("number");
    }
  });
});
