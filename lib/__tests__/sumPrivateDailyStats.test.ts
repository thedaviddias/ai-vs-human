import { describe, expect, it } from "vitest";
import { sumPrivateDailyStats } from "../aggregateUserStats";

describe("sumPrivateDailyStats", () => {
  it("returns 0 for an empty array", () => {
    expect(sumPrivateDailyStats([])).toBe(0);
  });

  it("sums human + ai + automation for a single day", () => {
    const stats = [{ human: 10, ai: 5, automation: 3 }];
    expect(sumPrivateDailyStats(stats)).toBe(18);
  });

  it("sums across multiple days", () => {
    const stats = [
      { human: 10, ai: 5, automation: 3 },
      { human: 20, ai: 8, automation: 2 },
      { human: 5, ai: 0, automation: 1 },
    ];
    expect(sumPrivateDailyStats(stats)).toBe(54);
  });

  it("handles zeros in individual fields", () => {
    const stats = [
      { human: 0, ai: 0, automation: 0 },
      { human: 0, ai: 3, automation: 0 },
    ];
    expect(sumPrivateDailyStats(stats)).toBe(3);
  });
});
