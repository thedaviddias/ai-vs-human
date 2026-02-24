import { describe, expect, it } from "vitest";
import { transformToHeroData } from "../HeroChart";

// ─── Test helpers ──────────────────────────────────────────────────────

/** Builds a full weekly data point for the hero chart input. */
function makeDataPoint(
  overrides: Partial<{
    weekLabel: string;
    human: number;
    aiAssisted: number;
    copilot: number;
    claude: number;
    cursor: number;
    dependabot: number;
    renovate: number;
    githubActions: number;
    otherBot: number;
    humanAdditions: number;
    copilotAdditions: number;
    claudeAdditions: number;
    cursorAdditions: number;
    aiAssistedAdditions: number;
  }>
) {
  return {
    weekLabel: overrides.weekLabel ?? "2024-W01",
    human: overrides.human ?? 0,
    aiAssisted: overrides.aiAssisted ?? 0,
    copilot: overrides.copilot ?? 0,
    claude: overrides.claude ?? 0,
    cursor: overrides.cursor ?? 0,
    dependabot: overrides.dependabot ?? 0,
    renovate: overrides.renovate ?? 0,
    githubActions: overrides.githubActions ?? 0,
    otherBot: overrides.otherBot ?? 0,
    humanAdditions: overrides.humanAdditions ?? 0,
    copilotAdditions: overrides.copilotAdditions ?? 0,
    claudeAdditions: overrides.claudeAdditions ?? 0,
    cursorAdditions: overrides.cursorAdditions ?? 0,
    aiAssistedAdditions: overrides.aiAssistedAdditions ?? 0,
  };
}

// ─── transformToHeroData ───────────────────────────────────────────────

describe("transformToHeroData", () => {
  describe("commit aggregation", () => {
    it("aggregates AI tools into single aiAssisted value", () => {
      const result = transformToHeroData([
        makeDataPoint({
          aiAssisted: 5,
          copilot: 10,
          claude: 8,
          cursor: 3,
        }),
      ]);
      // aiAssisted = 5 + 10 + 8 + 3 = 26
      expect(result[0].aiAssisted).toBe(26);
    });

    it("preserves human count as-is", () => {
      const result = transformToHeroData([makeDataPoint({ human: 42 })]);
      expect(result[0].human).toBe(42);
    });

    it("drops automation bots from output (not in aiAssisted)", () => {
      const result = transformToHeroData([
        makeDataPoint({
          dependabot: 100,
          renovate: 50,
          githubActions: 25,
          otherBot: 10,
          human: 5,
          copilot: 2,
        }),
      ]);
      // Output only has human + aiAssisted (not bot counts)
      expect(result[0].human).toBe(5);
      expect(result[0].aiAssisted).toBe(2); // only copilot
      // Verify bots are not in the output structure
      expect(result[0]).not.toHaveProperty("dependabot");
      expect(result[0]).not.toHaveProperty("renovate");
      expect(result[0]).not.toHaveProperty("githubActions");
      expect(result[0]).not.toHaveProperty("otherBot");
    });
  });

  describe("LOC aggregation", () => {
    it("aggregates AI tool additions into aiAdditions", () => {
      const result = transformToHeroData([
        makeDataPoint({
          copilotAdditions: 200,
          claudeAdditions: 300,
          cursorAdditions: 100,
          aiAssistedAdditions: 50,
        }),
      ]);
      expect(result[0].aiAdditions).toBe(650); // 200 + 300 + 100 + 50
    });

    it("preserves humanAdditions as-is", () => {
      const result = transformToHeroData([makeDataPoint({ humanAdditions: 1500 })]);
      expect(result[0].humanAdditions).toBe(1500);
    });

    it("defaults missing LOC fields to 0", () => {
      // Input without LOC fields (simulates pre-LOC data)
      const result = transformToHeroData([
        {
          weekLabel: "2024-W01",
          human: 10,
          aiAssisted: 2,
          copilot: 1,
          claude: 0,
          dependabot: 0,
          renovate: 0,
          githubActions: 0,
          otherBot: 0,
          // No LOC fields at all
        },
      ]);
      expect(result[0].humanAdditions).toBe(0);
      expect(result[0].aiAdditions).toBe(0);
    });
  });

  describe("output shape", () => {
    it("preserves weekLabel", () => {
      const result = transformToHeroData([makeDataPoint({ weekLabel: "2025-W14" })]);
      expect(result[0].weekLabel).toBe("2025-W14");
    });

    it("returns empty array for empty input", () => {
      expect(transformToHeroData([])).toEqual([]);
    });

    it("transforms multiple weeks", () => {
      const result = transformToHeroData([
        makeDataPoint({ weekLabel: "2024-W01", human: 10 }),
        makeDataPoint({ weekLabel: "2024-W02", human: 20 }),
      ]);
      expect(result).toHaveLength(2);
      expect(result[0].weekLabel).toBe("2024-W01");
      expect(result[1].weekLabel).toBe("2024-W02");
    });
  });

  // ─── KEY SCENARIO ────────────────────────────────────────────────────
  // Verifies the chart data correctly represents the LOC story even when
  // commit counts tell a different story.
  describe("Chart data scenario: LOC parity with commit count disparity", () => {
    it("produces correct chart data for 100 human vs 2 Claude commits with equal LOC", () => {
      const result = transformToHeroData([
        makeDataPoint({
          human: 100, // 100 human commits (10 LOC each)
          claude: 2, // 2 Claude commits (500 LOC each)
          humanAdditions: 1000, // 100 * 10
          claudeAdditions: 1000, // 2 * 500
        }),
      ]);

      // By commits: heavily skewed toward human
      expect(result[0].human).toBe(100);
      expect(result[0].aiAssisted).toBe(2);

      // By LOC: exactly 50/50 — chart should show parity
      expect(result[0].humanAdditions).toBe(1000);
      expect(result[0].aiAdditions).toBe(1000);
    });
  });
});
