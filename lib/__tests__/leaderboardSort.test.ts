import { describe, expect, it } from "vitest";
import { getPublicCommitCount, getPublicStarCount } from "../leaderboardSort";

describe("getPublicCommitCount", () => {
  it("returns publicTotalCommits when present", () => {
    expect(getPublicCommitCount({ totalCommits: 800, publicTotalCommits: 500 })).toBe(500);
  });

  it("falls back to totalCommits when publicTotalCommits is absent", () => {
    expect(getPublicCommitCount({ totalCommits: 1200 })).toBe(1200);
  });

  it("returns 0 when publicTotalCommits is 0 (does not fall back)", () => {
    expect(getPublicCommitCount({ totalCommits: 300, publicTotalCommits: 0 })).toBe(0);
  });

  it("ensures fair ranking: user with more public commits ranks higher", () => {
    const userA = { totalCommits: 2000, publicTotalCommits: 400 }; // inflated by private
    const userB = { totalCommits: 600, publicTotalCommits: 600 }; // all public

    expect(getPublicCommitCount(userB)).toBeGreaterThan(getPublicCommitCount(userA));
  });
});

describe("getPublicStarCount", () => {
  it("returns publicTotalStars when present", () => {
    expect(getPublicStarCount({ totalStars: 100, publicTotalStars: 80 })).toBe(80);
  });

  it("falls back to totalStars when publicTotalStars is absent", () => {
    expect(getPublicStarCount({ totalStars: 250 })).toBe(250);
  });

  it("returns 0 when publicTotalStars is 0 (does not fall back)", () => {
    expect(getPublicStarCount({ totalStars: 50, publicTotalStars: 0 })).toBe(0);
  });
});
