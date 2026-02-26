import { describe, expect, it } from "vitest";
import { LEADERBOARD_NAV, type LeaderboardNavItem } from "../leaderboardNav";

describe("LEADERBOARD_NAV", () => {
  it("exports an array of navigation items", () => {
    expect(Array.isArray(LEADERBOARD_NAV)).toBe(true);
    expect(LEADERBOARD_NAV.length).toBeGreaterThan(0);
  });

  it("each item has required label and href", () => {
    for (const item of LEADERBOARD_NAV) {
      expect(item.label).toBeTruthy();
      expect(item.href).toBeTruthy();
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("includes Overview as the first entry", () => {
    expect(LEADERBOARD_NAV[0].label).toBe("Overview");
    expect(LEADERBOARD_NAV[0].href).toBe("/leaderboard");
  });

  it("includes expected sections", () => {
    const labels = LEADERBOARD_NAV.map((item: LeaderboardNavItem) => item.label);
    expect(labels).toContain("Developers");
    expect(labels).toContain("Repos");
    expect(labels).toContain("AI Tools");
    expect(labels).toContain("Bots");
  });

  it("every item has a description string", () => {
    for (const item of LEADERBOARD_NAV) {
      expect(typeof item.description).toBe("string");
      expect(item.description!.length).toBeGreaterThan(0);
    }
  });
});
