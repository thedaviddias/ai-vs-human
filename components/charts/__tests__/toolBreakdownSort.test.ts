import { describe, expect, it } from "vitest";
import { sortAiBreakdown, sortBotBreakdown } from "../toolBreakdownSort";

describe("sortAiBreakdown", () => {
  it("pins priority AI tools first", () => {
    const sorted = sortAiBreakdown(
      [
        { key: "greptile", label: "Greptile", commits: 20, additions: 200 },
        { key: "coderabbit", label: "CodeRabbit", commits: 3, additions: 30 },
        { key: "github-copilot", label: "GitHub Copilot", commits: 1, additions: 10 },
      ],
      "commits"
    );

    expect(sorted.map((item) => item.key)).toEqual(["github-copilot", "coderabbit", "greptile"]);
  });

  it("uses additions as primary impact in loc mode", () => {
    const sorted = sortAiBreakdown(
      [
        { key: "codeium", label: "Codeium", commits: 10, additions: 100 },
        { key: "windsurf", label: "Windsurf", commits: 5, additions: 300 },
      ],
      "loc"
    );

    expect(sorted.map((item) => item.key)).toEqual(["windsurf", "codeium"]);
  });
});

describe("sortBotBreakdown", () => {
  it("pins major automation bots before others", () => {
    const sorted = sortBotBreakdown([
      { key: "codecov", label: "Codecov", commits: 40 },
      { key: "renovate", label: "Renovate", commits: 5 },
      { key: "dependabot", label: "Dependabot", commits: 3 },
    ]);

    expect(sorted.map((item) => item.key)).toEqual(["dependabot", "renovate", "codecov"]);
  });
});
