import { describe, expect, it } from "vitest";
import {
  aggregateMultiRepoStats,
  buildBreakdownFromWeeklyStats,
  computeUserSummary,
  mergeDetailedBreakdowns,
  mergePublicAndPrivateWeeklyStats,
} from "../aggregateUserStats";

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
    it("counts AI as aiAssisted + copilot + claude + cursor (separate from automation)", () => {
      const input = [
        makeWeek({
          human: 50,
          copilot: 10,
          claude: 5,
          cursor: 3,
          aiAssisted: 2,
          dependabot: 100,
          renovate: 50,
          total: 220,
        }),
      ];
      const summary = computeUserSummary(input);
      expect(summary.totals.ai).toBe(20); // 10 + 5 + 3 + 2
      expect(summary.totals.human).toBe(50);
      expect(summary.totals.automation).toBe(150); // 100 + 50
      expect(summary.totals.total).toBe(220); // 50 + 20 + 150
    });

    it("computes correct AI percentage", () => {
      const input = [makeWeek({ human: 80, copilot: 20, total: 100 })];
      const summary = computeUserSummary(input);
      // AI = 20, total = 100, percentage = 20%
      expect(summary.aiPercentage).toBe("20.0");
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
      const input = [makeWeek({ humanAdditions: 100, totalAdditions: 100 })];
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
          totalAdditions: 1000,
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

  // ─── KEY SCENARIO ─────────────────────────────────────────────────
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
      expect(summary.aiPercentage).toBe("9.1");

      // By LOC: 4500/5000 = 90% AI — ACCURATE
      expect(summary.locBotPercentage).toBe("90.0");
      expect(summary.locHumanPercentage).toBe("10.0");

      // This proves the LOC metric tells a more accurate story:
      // AI wrote 90% of the actual code, even though humans made 91% of commits
      expect(summary.hasLocData).toBe(true);
    });
  });
});

// ─── mergePublicAndPrivateWeeklyStats ─────────────────────────────────

describe("mergePublicAndPrivateWeeklyStats", () => {
  it("returns public stats when private is empty", () => {
    const pub = [makeWeek({ human: 10, total: 10 })];
    expect(mergePublicAndPrivateWeeklyStats(pub, [])).toEqual(pub);
  });

  it("returns private stats when public is empty", () => {
    const priv = [makeWeek({ human: 5, total: 5 })];
    expect(mergePublicAndPrivateWeeklyStats([], priv)).toEqual(priv);
  });

  it("concatenates both arrays for aggregation to merge by weekStart", () => {
    const pub = [makeWeek({ human: 10, copilot: 5, total: 15 })];
    const priv = [makeWeek({ human: 20, claude: 3, total: 23 })];
    const merged = mergePublicAndPrivateWeeklyStats(pub, priv);
    expect(merged).toHaveLength(2);

    // When passed through aggregateMultiRepoStats, same-week rows are summed
    const aggregated = aggregateMultiRepoStats(merged);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].human).toBe(30);
    expect(aggregated[0].copilot).toBe(5);
    expect(aggregated[0].claude).toBe(3);
    expect(aggregated[0].total).toBe(38);
  });

  it("produces correct merged percentages through the full pipeline", () => {
    // Public: 80 human, 20 AI → 80% human (public only)
    const pub = [makeWeek({ human: 80, copilot: 20, total: 100 })];
    // Private: 50 human, 50 AI → when merged: 130 human, 70 AI → 65% human
    const priv = [makeWeek({ human: 50, copilot: 50, total: 100 })];

    const merged = mergePublicAndPrivateWeeklyStats(pub, priv);
    const aggregated = aggregateMultiRepoStats(merged);
    const summary = computeUserSummary(aggregated);

    // Total: 130 human + 70 AI = 200
    expect(summary.totals.human).toBe(130);
    expect(summary.totals.ai).toBe(70);
    expect(summary.totals.total).toBe(200);
    expect(summary.humanPercentage).toBe("65.0");
    expect(summary.aiPercentage).toBe("35.0");
  });

  it("keeps different weeks separate in merged output", () => {
    const pub = [makeWeek({ weekStart: 1704067200000, weekLabel: "2024-W01", human: 10 })];
    const priv = [makeWeek({ weekStart: 1704672000000, weekLabel: "2024-W02", human: 20 })];

    const merged = mergePublicAndPrivateWeeklyStats(pub, priv);
    const aggregated = aggregateMultiRepoStats(merged);
    expect(aggregated).toHaveLength(2);
    expect(aggregated[0].human).toBe(10);
    expect(aggregated[1].human).toBe(20);
  });
});

// ─── buildBreakdownFromWeeklyStats ──────────────────────────────────────

describe("buildBreakdownFromWeeklyStats", () => {
  it("extracts AI tool breakdown from weekly stats", () => {
    const stats = [
      makeWeek({ copilot: 10, claude: 5, copilotAdditions: 500, claudeAdditions: 200 }),
      makeWeek({ copilot: 20, claude: 15, copilotAdditions: 1000, claudeAdditions: 800 }),
    ];
    const { toolBreakdown } = buildBreakdownFromWeeklyStats(stats);

    const copilot = toolBreakdown.find((t) => t.key === "github-copilot");
    expect(copilot).toBeDefined();
    expect(copilot!.commits).toBe(30);
    expect(copilot!.additions).toBe(1500);
    expect(copilot!.label).toBe("GitHub Copilot");

    const claude = toolBreakdown.find((t) => t.key === "claude-code");
    expect(claude).toBeDefined();
    expect(claude!.commits).toBe(20);
    expect(claude!.additions).toBe(1000);
  });

  it("extracts bot breakdown from weekly stats", () => {
    const stats = [
      makeWeek({ dependabot: 30, renovate: 10, githubActions: 5 }),
      makeWeek({ dependabot: 20, renovate: 5, otherBot: 2 }),
    ];
    const { botBreakdown } = buildBreakdownFromWeeklyStats(stats);

    const dependabot = botBreakdown.find((b) => b.key === "dependabot");
    expect(dependabot).toBeDefined();
    expect(dependabot!.commits).toBe(50);

    const renovate = botBreakdown.find((b) => b.key === "renovate");
    expect(renovate!.commits).toBe(15);

    const actions = botBreakdown.find((b) => b.key === "github-actions");
    expect(actions!.commits).toBe(5);

    const other = botBreakdown.find((b) => b.key === "other-bot");
    expect(other!.commits).toBe(2);
  });

  it("omits tools with zero commits and zero additions", () => {
    const stats = [makeWeek({ copilot: 10, copilotAdditions: 100 })];
    const { toolBreakdown, botBreakdown } = buildBreakdownFromWeeklyStats(stats);

    // Only copilot should appear — all others are 0
    expect(toolBreakdown).toHaveLength(1);
    expect(toolBreakdown[0].key).toBe("github-copilot");

    // No bots had commits
    expect(botBreakdown).toHaveLength(0);
  });

  it("includes tool with additions but zero commits", () => {
    // Edge case: a tool has LOC additions but no commit count (shouldn't happen,
    // but the function should handle it gracefully)
    const stats = [makeWeek({ cursorAdditions: 500 })];
    const { toolBreakdown } = buildBreakdownFromWeeklyStats(stats);

    const cursor = toolBreakdown.find((t) => t.key === "cursor");
    expect(cursor).toBeDefined();
    expect(cursor!.commits).toBe(0);
    expect(cursor!.additions).toBe(500);
  });

  it("omits aiAssisted from tool breakdown (it's a catch-all)", () => {
    const stats = [makeWeek({ aiAssisted: 50, aiAssistedAdditions: 1000 })];
    const { toolBreakdown } = buildBreakdownFromWeeklyStats(stats);

    // aiAssisted should NOT appear as a specific tool
    const aiAssisted = toolBreakdown.find((t) => t.label.includes("aiAssisted"));
    expect(aiAssisted).toBeUndefined();
    expect(toolBreakdown).toHaveLength(0);
  });

  it("returns empty arrays for empty input", () => {
    const { toolBreakdown, botBreakdown } = buildBreakdownFromWeeklyStats([]);
    expect(toolBreakdown).toEqual([]);
    expect(botBreakdown).toEqual([]);
  });
});

// ─── mergeDetailedBreakdowns ────────────────────────────────────────────

describe("mergeDetailedBreakdowns", () => {
  it("sums matching tool keys from public and private", () => {
    const publicBreakdown = {
      toolBreakdown: [
        { key: "github-copilot", label: "GitHub Copilot", commits: 100, additions: 5000 },
        { key: "claude-code", label: "Claude Code", commits: 50, additions: 2000 },
      ],
      botBreakdown: [{ key: "dependabot", label: "Dependabot", commits: 30 }],
    };
    const privateBreakdown = {
      toolBreakdown: [
        { key: "github-copilot", label: "GitHub Copilot", commits: 80, additions: 3000 },
        { key: "claude-code", label: "Claude Code", commits: 20, additions: 1000 },
      ],
      botBreakdown: [{ key: "dependabot", label: "Dependabot", commits: 10 }],
    };

    const merged = mergeDetailedBreakdowns(publicBreakdown, privateBreakdown);

    const copilot = merged.toolBreakdown.find((t) => t.key === "github-copilot");
    expect(copilot!.commits).toBe(180); // 100 + 80
    expect(copilot!.additions).toBe(8000); // 5000 + 3000

    const claude = merged.toolBreakdown.find((t) => t.key === "claude-code");
    expect(claude!.commits).toBe(70); // 50 + 20
    expect(claude!.additions).toBe(3000); // 2000 + 1000

    const dependabot = merged.botBreakdown.find((b) => b.key === "dependabot");
    expect(dependabot!.commits).toBe(40); // 30 + 10
  });

  it("preserves granular public keys not in private data", () => {
    const publicBreakdown = {
      toolBreakdown: [
        { key: "github-copilot", label: "GitHub Copilot", commits: 100, additions: 5000 },
        { key: "coderabbit", label: "CodeRabbit", commits: 15, additions: 200 },
      ],
      botBreakdown: [
        { key: "dependabot", label: "Dependabot", commits: 30 },
        { key: "semantic-release", label: "Semantic Release", commits: 10 },
      ],
    };
    const privateBreakdown = {
      toolBreakdown: [
        { key: "github-copilot", label: "GitHub Copilot", commits: 50, additions: 2000 },
      ],
      botBreakdown: [{ key: "renovate", label: "Renovate", commits: 20 }],
    };

    const merged = mergeDetailedBreakdowns(publicBreakdown, privateBreakdown);

    // Copilot is summed
    expect(merged.toolBreakdown.find((t) => t.key === "github-copilot")!.commits).toBe(150);

    // CodeRabbit only exists in public — preserved unchanged
    expect(merged.toolBreakdown.find((t) => t.key === "coderabbit")!.commits).toBe(15);

    // Semantic Release only in public — preserved
    expect(merged.botBreakdown.find((b) => b.key === "semantic-release")!.commits).toBe(10);

    // Renovate only in private — added
    expect(merged.botBreakdown.find((b) => b.key === "renovate")!.commits).toBe(20);

    // Total unique keys
    expect(merged.toolBreakdown).toHaveLength(2);
    expect(merged.botBreakdown).toHaveLength(3);
  });

  it("adds private-only tools to the merged result", () => {
    const publicBreakdown = {
      toolBreakdown: [
        { key: "github-copilot", label: "GitHub Copilot", commits: 100, additions: 5000 },
      ],
      botBreakdown: [],
    };
    const privateBreakdown = {
      toolBreakdown: [{ key: "cursor", label: "Cursor", commits: 30, additions: 1500 }],
      botBreakdown: [{ key: "github-actions", label: "GitHub Actions", commits: 5 }],
    };

    const merged = mergeDetailedBreakdowns(publicBreakdown, privateBreakdown);

    // Cursor only in private — added
    const cursor = merged.toolBreakdown.find((t) => t.key === "cursor");
    expect(cursor).toBeDefined();
    expect(cursor!.commits).toBe(30);

    // GitHub Actions only in private — added
    expect(merged.botBreakdown).toHaveLength(1);
    expect(merged.botBreakdown[0].key).toBe("github-actions");
  });

  it("handles empty private breakdown (returns public as-is)", () => {
    const publicBreakdown = {
      toolBreakdown: [
        { key: "github-copilot", label: "GitHub Copilot", commits: 100, additions: 5000 },
      ],
      botBreakdown: [{ key: "dependabot", label: "Dependabot", commits: 30 }],
    };
    const privateBreakdown = { toolBreakdown: [], botBreakdown: [] };

    const merged = mergeDetailedBreakdowns(publicBreakdown, privateBreakdown);
    expect(merged.toolBreakdown).toEqual(publicBreakdown.toolBreakdown);
    expect(merged.botBreakdown).toEqual(publicBreakdown.botBreakdown);
  });
});

// ─── formatPercentage edge cases (via computeUserSummary) ──────────────

describe("computeUserSummary — formatPercentage edge cases", () => {
  it("formats very small percentages (< 0.1) with 2 decimal places", () => {
    // ai = 1, total = 2000 → (1/2000)*100 = 0.05 → "0.05"
    const input = [makeWeek({ human: 1999, copilot: 1, total: 2000 })];
    const summary = computeUserSummary(input);
    expect(summary.aiPercentage).toBe("0.05");
  });

  it("trims trailing zero from very small percentages rounded to X.X0", () => {
    // ai = 1, total ≈ 1001 → (1/1001)*100 ≈ 0.0999 → toFixed(2) = "0.10" → trimmed to "0.1"
    const input = [makeWeek({ human: 1000, copilot: 1, total: 1001 })];
    const summary = computeUserSummary(input);
    expect(summary.aiPercentage).toBe("0.1");
  });

  it("formats exactly zero as '0' (not '0.0')", () => {
    const input = [makeWeek({ human: 100, total: 100 })];
    const summary = computeUserSummary(input);
    expect(summary.aiPercentage).toBe("0");
  });

  it("returns '0' for all percentages when total is 0", () => {
    const summary = computeUserSummary([]);
    expect(summary.aiPercentage).toBe("0");
    expect(summary.humanPercentage).toBe("0");
    expect(summary.automationPercentage).toBe("0");
  });

  it("formats LOC percentages < 0.1 correctly", () => {
    // aiAdditions = 1, totalAdditions = 2000 → 0.05%
    const input = [makeWeek({ humanAdditions: 1999, copilotAdditions: 1, totalAdditions: 2000 })];
    const summary = computeUserSummary(input);
    expect(summary.locBotPercentage).toBe("0.05");
  });
});
