import { describe, expect, it } from "vitest";
import { shouldShowZeroAiGuidance } from "../zeroAiGuidance";

describe("shouldShowZeroAiGuidance", () => {
  it("returns true when feature is enabled, total commits are positive, and AI is 0", () => {
    expect(
      shouldShowZeroAiGuidance({
        showZeroAiWhyCta: true,
        botPercentage: "0",
        totalCommits: 42,
      })
    ).toBe(true);
  });

  it("returns false when AI percentage is above zero", () => {
    expect(
      shouldShowZeroAiGuidance({
        showZeroAiWhyCta: true,
        botPercentage: "0.1",
        totalCommits: 42,
      })
    ).toBe(false);
  });

  it("returns false when total commits are zero", () => {
    expect(
      shouldShowZeroAiGuidance({
        showZeroAiWhyCta: true,
        botPercentage: "0",
        totalCommits: 0,
      })
    ).toBe(false);
  });

  it("returns false when feature flag is disabled", () => {
    expect(
      shouldShowZeroAiGuidance({
        showZeroAiWhyCta: false,
        botPercentage: "0",
        totalCommits: 42,
      })
    ).toBe(false);
  });
});
