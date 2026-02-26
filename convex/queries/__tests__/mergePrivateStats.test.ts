import { describe, expect, it } from "vitest";
import {
  computeMergedUserStats,
  type MergeableUser,
  type PrivateDayStat,
  shouldMergePrivateData,
} from "../userHelpers";

// ─── Test helpers ──────────────────────────────────────────────────────

function makeUser(overrides: Partial<MergeableUser> = {}): MergeableUser {
  return {
    owner: "thedaviddias",
    humanCommits: 7000,
    botCommits: 400,
    automationCommits: 1000,
    totalCommits: 8400,
    humanPercentage: "83.3",
    botPercentage: "4.8",
    automationPercentage: "11.9",
    ...overrides,
  };
}

function makeDays(
  days: Array<{ human: number; ai: number; automation: number }>
): PrivateDayStat[] {
  return days;
}

// ─── computeMergedUserStats ──────────────────────────────────────────

describe("computeMergedUserStats", () => {
  it("returns the original user unchanged when private stats are empty", () => {
    const user = makeUser();
    const result = computeMergedUserStats(user, []);
    expect(result.totalCommits).toBe(8400);
    expect(result.humanCommits).toBe(7000);
    expect(result.botCommits).toBe(400);
    expect(result.automationCommits).toBe(1000);
  });

  it("adds private commits to public commits for the correct merged total", () => {
    const user = makeUser({
      humanCommits: 7000,
      botCommits: 400,
      automationCommits: 1000,
      totalCommits: 8400,
    });
    const privateDays = makeDays([
      { human: 5000, ai: 300, automation: 200 },
      { human: 1500, ai: 100, automation: 300 },
    ]);

    const result = computeMergedUserStats(user, privateDays);

    // Private totals: human=6500, ai=400, automation=500 → 7400
    expect(result.humanCommits).toBe(7000 + 6500); // 13500
    expect(result.botCommits).toBe(400 + 400); // 800
    expect(result.automationCommits).toBe(1000 + 500); // 1500
    expect(result.totalCommits).toBe(13500 + 800 + 1500); // 15800
  });

  it("recalculates percentages after merging", () => {
    const user = makeUser({
      humanCommits: 100,
      botCommits: 0,
      automationCommits: 0,
      totalCommits: 100,
    });
    const privateDays = makeDays([{ human: 0, ai: 100, automation: 0 }]);

    const result = computeMergedUserStats(user, privateDays);

    expect(result.humanPercentage).toBe("50.0");
    expect(result.botPercentage).toBe("50.0");
    expect(result.automationPercentage).toBe("0");
  });

  it("handles all-zero private stats gracefully", () => {
    const user = makeUser();
    const privateDays = makeDays([
      { human: 0, ai: 0, automation: 0 },
      { human: 0, ai: 0, automation: 0 },
    ]);

    const result = computeMergedUserStats(user, privateDays);

    // Zero private data changes nothing
    expect(result.totalCommits).toBe(8400);
  });

  it("handles user with zero public commits + non-zero private", () => {
    const user = makeUser({
      humanCommits: 0,
      botCommits: 0,
      automationCommits: 0,
      totalCommits: 0,
    });
    const privateDays = makeDays([{ human: 50, ai: 10, automation: 5 }]);

    const result = computeMergedUserStats(user, privateDays);

    expect(result.totalCommits).toBe(65);
    expect(result.humanCommits).toBe(50);
    expect(result.botCommits).toBe(10);
    expect(result.automationCommits).toBe(5);
  });

  it("sums multiple days correctly", () => {
    const user = makeUser({
      humanCommits: 0,
      botCommits: 0,
      automationCommits: 0,
      totalCommits: 0,
    });
    const privateDays = makeDays([
      { human: 10, ai: 5, automation: 2 },
      { human: 20, ai: 3, automation: 1 },
      { human: 30, ai: 2, automation: 0 },
    ]);

    const result = computeMergedUserStats(user, privateDays);

    expect(result.humanCommits).toBe(60);
    expect(result.botCommits).toBe(10);
    expect(result.automationCommits).toBe(3);
    expect(result.totalCommits).toBe(73);
  });

  it("preserves other user properties through the merge", () => {
    const user = {
      ...makeUser(),
      repoCount: 30,
      totalStars: 500,
      avatarUrl: "https://example.com/avatar.png",
    };
    const privateDays = makeDays([{ human: 100, ai: 0, automation: 0 }]);

    const result = computeMergedUserStats(user, privateDays);

    expect(result.repoCount).toBe(30);
    expect(result.totalStars).toBe(500);
    expect(result.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("produces percentages that match the real scenario (8.4K public + 7.4K private)", () => {
    const user = makeUser({
      humanCommits: 7500,
      botCommits: 470,
      automationCommits: 430,
      totalCommits: 8400,
    });
    // 7400 private commits split roughly
    const privateDays = makeDays([{ human: 6800, ai: 400, automation: 200 }]);

    const result = computeMergedUserStats(user, privateDays);

    expect(result.totalCommits).toBe(8400 + 7400); // 15800
    expect(result.humanCommits).toBe(7500 + 6800); // 14300
    expect(result.botCommits).toBe(470 + 400); // 870
    expect(result.automationCommits).toBe(430 + 200); // 630
  });
});

// ─── shouldMergePrivateData ──────────────────────────────────────────

describe("shouldMergePrivateData", () => {
  it("returns true when hasPrivateData and showPublicly are both true", () => {
    expect(
      shouldMergePrivateData({
        hasPrivateData: true,
        showPrivateDataPublicly: true,
      })
    ).toBe(true);
  });

  it("returns true when hasPrivateData is true and showPublicly is undefined (default)", () => {
    expect(
      shouldMergePrivateData({
        hasPrivateData: true,
        showPrivateDataPublicly: undefined,
      })
    ).toBe(true);
  });

  it("returns false when hasPrivateData is false", () => {
    expect(
      shouldMergePrivateData({
        hasPrivateData: false,
        showPrivateDataPublicly: true,
      })
    ).toBe(false);
  });

  it("returns false when showPrivateDataPublicly is explicitly false", () => {
    expect(
      shouldMergePrivateData({
        hasPrivateData: true,
        showPrivateDataPublicly: false,
      })
    ).toBe(false);
  });

  it("returns false when both are false", () => {
    expect(
      shouldMergePrivateData({
        hasPrivateData: false,
        showPrivateDataPublicly: false,
      })
    ).toBe(false);
  });
});
