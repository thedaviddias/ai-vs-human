import { describe, expect, it } from "vitest";
import { aggregateMultiRepoStats, computeUserSummary } from "../aggregateUserStats";

// ─── Test helpers ──────────────────────────────────────────────────────

/**
 * Builds a weekly stat row with sensible defaults.
 * Returns all fields needed by both WeeklyStatRow (for aggregateMultiRepoStats)
 * and AggregatedWeek (for computeUserSummary) — structural typing handles both.
 */
function makeWeek(
  overrides: Partial<{
    weekStart: number;
    weekLabel: string;
    human: number;
    dependabot: number;
    renovate: number;
    copilot: number;
    claude: number;
    cursor: number;
    aider: number;
    devin: number;
    openaiCodex: number;
    gemini: number;
    githubActions: number;
    otherBot: number;
    aiAssisted: number;
    total: number;
    humanAdditions: number;
    copilotAdditions: number;
    claudeAdditions: number;
    cursorAdditions: number;
    aiderAdditions: number;
    devinAdditions: number;
    openaiCodexAdditions: number;
    geminiAdditions: number;
    aiAssistedAdditions: number;
    totalAdditions: number;
    totalDeletions: number;
  }> = {}
) {
  return {
    weekStart: overrides.weekStart ?? 1704067200000, // 2024-01-01
    weekLabel: overrides.weekLabel ?? "2024-W01",
    human: overrides.human ?? 0,
    dependabot: overrides.dependabot ?? 0,
    renovate: overrides.renovate ?? 0,
    copilot: overrides.copilot ?? 0,
    claude: overrides.claude ?? 0,
    cursor: overrides.cursor ?? 0,
    aider: overrides.aider ?? 0,
    devin: overrides.devin ?? 0,
    openaiCodex: overrides.openaiCodex ?? 0,
    gemini: overrides.gemini ?? 0,
    githubActions: overrides.githubActions ?? 0,
    otherBot: overrides.otherBot ?? 0,
    aiAssisted: overrides.aiAssisted ?? 0,
    total: overrides.total ?? 0,
    humanAdditions: overrides.humanAdditions ?? 0,
    copilotAdditions: overrides.copilotAdditions ?? 0,
    claudeAdditions: overrides.claudeAdditions ?? 0,
    cursorAdditions: overrides.cursorAdditions ?? 0,
    aiderAdditions: overrides.aiderAdditions ?? 0,
    devinAdditions: overrides.devinAdditions ?? 0,
    openaiCodexAdditions: overrides.openaiCodexAdditions ?? 0,
    geminiAdditions: overrides.geminiAdditions ?? 0,
    aiAssistedAdditions: overrides.aiAssistedAdditions ?? 0,
    totalAdditions: overrides.totalAdditions ?? 0,
    totalDeletions: overrides.totalDeletions ?? 0,
  };
}

// ─── aggregateMultiRepoStats ───────────────────────────────────────────

describe("aggregateMultiRepoStats", () => {
  it("passes through a single repo, single week", () => {
    const input = [makeWeek({ human: 10, copilot: 3, total: 13 })];
    const result = aggregateMultiRepoStats(input);
    expect(result).toHaveLength(1);
    expect(result[0].human).toBe(10);
    expect(result[0].copilot).toBe(3);
    expect(result[0].total).toBe(13);
  });

  it("sums multiple repos for the same week", () => {
    const input = [
      makeWeek({ human: 10, claude: 5, total: 15 }),
      makeWeek({ human: 20, claude: 10, total: 30 }),
    ];
    const result = aggregateMultiRepoStats(input);
    expect(result).toHaveLength(1);
    expect(result[0].human).toBe(30);
    expect(result[0].claude).toBe(15);
    expect(result[0].total).toBe(45);
  });

  it("keeps different weeks as separate buckets, sorted ascending", () => {
    const week2 = makeWeek({
      weekStart: 1704672000000,
      weekLabel: "2024-W02",
      human: 5,
    });
    const week1 = makeWeek({
      weekStart: 1704067200000,
      weekLabel: "2024-W01",
      human: 10,
    });
    // Input in reverse order — should come out sorted
    const result = aggregateMultiRepoStats([week2, week1]);
    expect(result).toHaveLength(2);
    expect(result[0].weekLabel).toBe("2024-W01");
    expect(result[0].human).toBe(10);
    expect(result[1].weekLabel).toBe("2024-W02");
    expect(result[1].human).toBe(5);
  });

  it("defaults optional fields (cursor, LOC) to 0", () => {
    // Input without cursor or LOC fields
    const input = [
      {
        weekStart: 1704067200000,
        weekLabel: "2024-W01",
        human: 10,
        dependabot: 0,
        renovate: 0,
        copilot: 0,
        claude: 0,
        githubActions: 0,
        otherBot: 0,
        aiAssisted: 0,
        total: 10,
        // Deliberately omitting cursor, aider, devin, openaiCodex, gemini, all LOC fields
      },
    ];
    const result = aggregateMultiRepoStats(input);
    expect(result[0].cursor).toBe(0);
    expect(result[0].aider).toBe(0);
    expect(result[0].devin).toBe(0);
    expect(result[0].openaiCodex).toBe(0);
    expect(result[0].gemini).toBe(0);
    expect(result[0].humanAdditions).toBe(0);
    expect(result[0].copilotAdditions).toBe(0);
    expect(result[0].claudeAdditions).toBe(0);
    expect(result[0].cursorAdditions).toBe(0);
    expect(result[0].aiAssistedAdditions).toBe(0);
    expect(result[0].totalAdditions).toBe(0);
    expect(result[0].totalDeletions).toBe(0);
  });

  it("sums LOC fields across repos in same week", () => {
    const input = [
      makeWeek({ humanAdditions: 100, copilotAdditions: 50, totalAdditions: 150 }),
      makeWeek({ humanAdditions: 200, copilotAdditions: 75, totalAdditions: 275 }),
    ];
    const result = aggregateMultiRepoStats(input);
    expect(result[0].humanAdditions).toBe(300);
    expect(result[0].copilotAdditions).toBe(125);
    expect(result[0].totalAdditions).toBe(425);
  });

  it("returns empty array for empty input", () => {
    expect(aggregateMultiRepoStats([])).toEqual([]);
  });
});

// ─── computeUserSummary ────────────────────────────────────────────────

describe("computeUserSummary", () => {
  describe("commit-based totals", () => {
    it("counts AI as aiAssisted + copilot + claude + cursor (excludes bots)", () => {
      const input = [
        makeWeek({
          human: 50,
          copilot: 10,
          claude: 5,
          cursor: 3,
          aiAssisted: 2,
          dependabot: 100, // excluded!
          renovate: 50, // excluded!
          total: 220,
        }),
      ];
      const summary = computeUserSummary(input);
      expect(summary.totals.ai).toBe(20); // 10 + 5 + 3 + 2
      expect(summary.totals.human).toBe(50);
      expect(summary.totals.total).toBe(70); // 50 + 20 (bots excluded)
    });

    it("computes correct AI percentage", () => {
      const input = [makeWeek({ human: 80, copilot: 20, total: 100 })];
      const summary = computeUserSummary(input);
      // AI = 20, total = 100, percentage = 20%
      expect(summary.botPercentage).toBe("20.0");
      expect(summary.humanPercentage).toBe("80.0");
    });
  });

  describe("LOC-based metrics", () => {
    it("computes locTotals correctly", () => {
      const input = [
        makeWeek({
          humanAdditions: 1000,
          copilotAdditions: 500,
          claudeAdditions: 300,
          cursorAdditions: 100,
          aiAssistedAdditions: 100,
        }),
      ];
      const summary = computeUserSummary(input);
      expect(summary.locTotals.humanAdditions).toBe(1000);
      expect(summary.locTotals.aiAdditions).toBe(1000); // 500 + 300 + 100 + 100
    });

    it("hasLocData = true when LOC data exists", () => {
      const input = [makeWeek({ humanAdditions: 100 })];
      const summary = computeUserSummary(input);
      expect(summary.hasLocData).toBe(true);
    });

    it("hasLocData = false when all LOC = 0 (backward compat)", () => {
      const input = [makeWeek({ human: 10, total: 10 })];
      const summary = computeUserSummary(input);
      expect(summary.hasLocData).toBe(false);
      expect(summary.locBotPercentage).toBeNull();
      expect(summary.locHumanPercentage).toBeNull();
    });

    it("computes locBotPercentage and locHumanPercentage", () => {
      const input = [
        makeWeek({
          humanAdditions: 200,
          copilotAdditions: 800,
        }),
      ];
      const summary = computeUserSummary(input);
      // AI = 800, Human = 200, Total = 1000
      expect(summary.locBotPercentage).toBe("80.0");
      expect(summary.locHumanPercentage).toBe("20.0");
    });
  });

  describe("trend calculation", () => {
    it("computes trend from last 4 vs previous 4 weeks", () => {
      const weeks = [];
      // Previous 4 weeks: 10 AI commits each = 40 total
      for (let i = 0; i < 4; i++) {
        weeks.push(
          makeWeek({
            weekStart: 1704067200000 + i * 604800000,
            weekLabel: `2024-W0${i + 1}`,
            copilot: 10,
          })
        );
      }
      // Recent 4 weeks: 20 AI commits each = 80 total
      for (let i = 4; i < 8; i++) {
        weeks.push(
          makeWeek({
            weekStart: 1704067200000 + i * 604800000,
            weekLabel: `2024-W0${i + 1}`,
            copilot: 20,
          })
        );
      }
      const summary = computeUserSummary(weeks);
      // Trend: (80 - 40) / 40 * 100 = 100%
      expect(summary.trend).toBe(100);
    });

    it("returns 0 trend when previousAI = 0 (no divide-by-zero)", () => {
      const weeks = [
        makeWeek({
          weekStart: 1704067200000,
          weekLabel: "2024-W01",
          copilot: 10,
        }),
      ];
      const summary = computeUserSummary(weeks);
      expect(summary.trend).toBe(0);
    });
  });

  // ─── KEY SCENARIO ────────────────────────────────────────────────────
  // This is the most important test: it proves the system correctly
  // distinguishes between commit-based and LOC-based metrics.
  describe("Chart accuracy: LOC vs commit count", () => {
    it("shows LOC-based AI dominance despite human commit count dominance", () => {
      // Scenario: AI wrote 90% of code in 5 big commits,
      //           human made 50 small config tweaks (10 LOC each)
      const input = [
        makeWeek({
          human: 50, // 50 human commits
          claude: 5, // 5 Claude commits
          total: 55,
          humanAdditions: 500, // 50 * 10 LOC = 500 lines
          claudeAdditions: 4500, // 5 * 900 LOC = 4500 lines
          totalAdditions: 5000,
        }),
      ];

      const summary = computeUserSummary(input);

      // By commits: 50/(50+5) = 90.9% human — MISLEADING
      expect(summary.humanPercentage).toBe("90.9");
      expect(summary.botPercentage).toBe("9.1");

      // By LOC: 4500/(500+4500) = 90% AI — ACCURATE
      expect(summary.locBotPercentage).toBe("90.0");
      expect(summary.locHumanPercentage).toBe("10.0");

      // This proves the LOC metric tells a more accurate story:
      // AI wrote 90% of the actual code, even though humans made 91% of commits
      expect(summary.hasLocData).toBe(true);
    });
  });
});
