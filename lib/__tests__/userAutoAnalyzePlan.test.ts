import { describe, expect, it } from "vitest";
import { createUserAutoAnalyzePlan } from "../userAutoAnalyzePlan";

const owner = "thedaviddias";

const githubRepos = [
  { name: "repo-a", fullName: "thedaviddias/repo-a" },
  { name: "repo-b", fullName: "thedaviddias/repo-b" },
];

describe("createUserAutoAnalyzePlan", () => {
  it("does not trigger when all repos are already synced", () => {
    const plan = createUserAutoAnalyzePlan({
      owner,
      githubRepos,
      convexRepos: [
        { fullName: "thedaviddias/repo-a", repo: { syncStatus: "synced" } },
        { fullName: "thedaviddias/repo-b", repo: { syncStatus: "synced" } },
      ],
    });

    expect(plan).toEqual({
      shouldTrigger: false,
      reposToAnalyze: [],
      shouldKickPendingQueue: false,
      showBootstrapIndicator: false,
    });
  });

  it("triggers and queues only missing repos", () => {
    const plan = createUserAutoAnalyzePlan({
      owner,
      githubRepos,
      convexRepos: [
        { fullName: "thedaviddias/repo-a", repo: { syncStatus: "synced" } },
        { fullName: "thedaviddias/repo-b", repo: null },
      ],
    });

    expect(plan.shouldTrigger).toBe(true);
    expect(plan.reposToAnalyze).toEqual([{ owner, name: "repo-b" }]);
    expect(plan.shouldKickPendingQueue).toBe(false);
    expect(plan.showBootstrapIndicator).toBe(true);
  });

  it("triggers and retries repos in error state", () => {
    const plan = createUserAutoAnalyzePlan({
      owner,
      githubRepos,
      convexRepos: [
        { fullName: "thedaviddias/repo-a", repo: { syncStatus: "synced" } },
        { fullName: "thedaviddias/repo-b", repo: { syncStatus: "error" } },
      ],
    });

    expect(plan.shouldTrigger).toBe(true);
    expect(plan.reposToAnalyze).toEqual([{ owner, name: "repo-b" }]);
    expect(plan.shouldKickPendingQueue).toBe(false);
    expect(plan.showBootstrapIndicator).toBe(true);
  });

  it("kicks pending queue recovery when pending exists and nothing is syncing", () => {
    const plan = createUserAutoAnalyzePlan({
      owner,
      githubRepos,
      convexRepos: [
        { fullName: "thedaviddias/repo-a", repo: { syncStatus: "pending" } },
        { fullName: "thedaviddias/repo-b", repo: { syncStatus: "synced" } },
      ],
    });

    expect(plan.shouldTrigger).toBe(true);
    expect(plan.reposToAnalyze).toEqual([]);
    expect(plan.shouldKickPendingQueue).toBe(true);
    expect(plan.showBootstrapIndicator).toBe(false);
  });

  it("does not kick pending queue when a sync is already active", () => {
    const plan = createUserAutoAnalyzePlan({
      owner,
      githubRepos,
      convexRepos: [
        { fullName: "thedaviddias/repo-a", repo: { syncStatus: "pending" } },
        { fullName: "thedaviddias/repo-b", repo: { syncStatus: "syncing" } },
      ],
    });

    expect(plan).toEqual({
      shouldTrigger: false,
      reposToAnalyze: [],
      shouldKickPendingQueue: false,
      showBootstrapIndicator: false,
    });
  });
});
