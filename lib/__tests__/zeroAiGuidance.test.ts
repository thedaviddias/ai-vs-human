import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAttributionGuidanceType,
  hasSeenAttributionGuidance,
  markAttributionGuidanceSeen,
  shouldShowAttributionGuidance,
} from "../zeroAiGuidance";

describe("shouldShowAttributionGuidance", () => {
  it("returns true when feature is enabled, total commits are positive, and AI is 0", () => {
    expect(
      shouldShowAttributionGuidance({
        showZeroAiWhyCta: true,
        botPercentage: "0",
        totalCommits: 42,
      })
    ).toBe(true);
  });

  it("returns true when AI percentage is low (e.g., 2%)", () => {
    expect(
      shouldShowAttributionGuidance({
        showZeroAiWhyCta: true,
        botPercentage: "2",
        totalCommits: 42,
      })
    ).toBe(true);
  });

  it("returns false when AI percentage is 5% or above", () => {
    expect(
      shouldShowAttributionGuidance({
        showZeroAiWhyCta: true,
        botPercentage: "5",
        totalCommits: 42,
      })
    ).toBe(false);
  });

  it("returns false when total commits are zero", () => {
    expect(
      shouldShowAttributionGuidance({
        showZeroAiWhyCta: true,
        botPercentage: "0",
        totalCommits: 0,
      })
    ).toBe(false);
  });

  it("returns false when feature flag is disabled", () => {
    expect(
      shouldShowAttributionGuidance({
        showZeroAiWhyCta: false,
        botPercentage: "0",
        totalCommits: 42,
      })
    ).toBe(false);
  });
});

describe("getAttributionGuidanceType", () => {
  it("returns 'zero' when AI is exactly 0", () => {
    expect(getAttributionGuidanceType("0")).toBe("zero");
  });

  it("returns 'low' when AI is between 0 and 5", () => {
    expect(getAttributionGuidanceType("2")).toBe("low");
  });

  it("returns 'none' when AI is 5 or above", () => {
    expect(getAttributionGuidanceType("5")).toBe("none");
    expect(getAttributionGuidanceType("50")).toBe("none");
  });
});

describe("hasSeenAttributionGuidance / markAttributionGuidanceSeen", () => {
  const storageStore: Record<string, string> = {};

  beforeEach(() => {
    // Mock localStorage
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storageStore[key] ?? null,
      setItem: (key: string, value: string) => {
        storageStore[key] = value;
      },
      removeItem: (key: string) => {
        delete storageStore[key];
      },
    });
  });

  afterEach(() => {
    for (const key of Object.keys(storageStore)) {
      delete storageStore[key];
    }
    vi.unstubAllGlobals();
  });

  it("returns false when guidance has not been seen", () => {
    expect(hasSeenAttributionGuidance()).toBe(false);
  });

  it("returns true after marking guidance as seen", () => {
    markAttributionGuidanceSeen();
    expect(hasSeenAttributionGuidance()).toBe(true);
  });

  it("stores a timestamp in localStorage", () => {
    markAttributionGuidanceSeen();
    const stored = storageStore["avh:zero-ai-guidance-seen"];
    expect(stored).toBeDefined();
    expect(Number(stored)).toBeGreaterThan(0);
  });
});
