import { describe, expect, it } from "vitest";
import { getSyncBadgeLabel, getSyncStageLabel } from "../syncProgress";

describe("getSyncStageLabel", () => {
  it('returns commit count for "fetching_commits" with count', () => {
    expect(getSyncStageLabel("fetching_commits", 247)).toBe("247 commits fetched");
  });

  it('returns "Fetching commits..." for "fetching_commits" without count', () => {
    expect(getSyncStageLabel("fetching_commits")).toBe("Fetching commits...");
  });

  it('returns "Fetching commits..." for "fetching_commits" with 0 count', () => {
    expect(getSyncStageLabel("fetching_commits", 0)).toBe("Fetching commits...");
  });

  it('returns "Enriching LOC data..." for enriching_loc', () => {
    expect(getSyncStageLabel("enriching_loc")).toBe("Enriching LOC data...");
  });

  it('returns "Classifying PRs..." for classifying_prs', () => {
    expect(getSyncStageLabel("classifying_prs")).toBe("Classifying PRs...");
  });

  it('returns "Computing stats..." for computing_stats', () => {
    expect(getSyncStageLabel("computing_stats")).toBe("Computing stats...");
  });

  it('returns "Syncing..." for undefined stage', () => {
    expect(getSyncStageLabel()).toBe("Syncing...");
  });

  it('returns "Syncing..." for unknown stage', () => {
    expect(getSyncStageLabel("unknown_stage")).toBe("Syncing...");
  });

  it("formats large commit counts with locale separators", () => {
    const result = getSyncStageLabel("fetching_commits", 1234);
    // toLocaleString output varies by locale, but should contain the number
    expect(result).toContain("commits fetched");
    expect(result).toMatch(/1[,.]?234/);
  });
});

describe("getSyncBadgeLabel", () => {
  it('returns commit count for "fetching_commits" with count', () => {
    expect(getSyncBadgeLabel("fetching_commits", 100)).toBe("100 commits");
  });

  it('returns "Fetching..." for "fetching_commits" without count', () => {
    expect(getSyncBadgeLabel("fetching_commits")).toBe("Fetching...");
  });

  it('returns "LOC..." for enriching_loc', () => {
    expect(getSyncBadgeLabel("enriching_loc")).toBe("LOC...");
  });

  it('returns "PRs..." for classifying_prs', () => {
    expect(getSyncBadgeLabel("classifying_prs")).toBe("PRs...");
  });

  it('returns "Stats..." for computing_stats', () => {
    expect(getSyncBadgeLabel("computing_stats")).toBe("Stats...");
  });

  it('returns "Syncing" for undefined stage', () => {
    expect(getSyncBadgeLabel()).toBe("Syncing");
  });

  it('returns "Syncing" for unknown stage', () => {
    expect(getSyncBadgeLabel("anything")).toBe("Syncing");
  });
});
