import { describe, expect, it } from "vitest";
import {
  estimateOgComplexity,
  getBlendColor,
  getSplitSegments,
  normalizeCounts,
  parseOgSquareMode,
  pickOgSquareMode,
} from "../og/squareRendering";

describe("normalizeCounts", () => {
  it("normalizes missing and invalid automation values to zero", () => {
    const withUndefined = normalizeCounts(2, 3, undefined);
    expect(withUndefined).toEqual({ human: 2, ai: 3, automation: 0, total: 5 });

    const withNaN = normalizeCounts(2, 3, Number.NaN);
    expect(withNaN).toEqual({ human: 2, ai: 3, automation: 0, total: 5 });
  });
});

describe("getSplitSegments", () => {
  it("returns proportional split widths for mixed squares", () => {
    const segments = getSplitSegments(1, 1, 2, 4);
    expect(segments).not.toBeNull();
    expect(segments).toHaveLength(3);
    expect(segments?.map((segment) => segment.widthPct)).toEqual([25, 25, 50]);
  });
});

describe("getBlendColor", () => {
  it("returns weighted rgb color for mixed contributions", () => {
    const customColors = {
      human: ["#000000", "#000000", "#000000", "#000000", "#000000"],
      ai: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
      automation: ["#808080", "#808080", "#808080", "#808080", "#808080"],
    };
    const color = getBlendColor(1, 1, 0, 100, customColors);
    expect(color).toBe("rgb(128, 128, 128)");
  });
});

describe("estimateOgComplexity", () => {
  it("counts active cells and segment score from rendered cells", () => {
    const cells = [
      [normalizeCounts(1, 0, 0), normalizeCounts(1, 1, 0), normalizeCounts(0, 0, 0)],
      [normalizeCounts(1, 1, 1), null],
    ];
    expect(estimateOgComplexity(cells)).toEqual({
      activeCellCount: 3,
      segmentScore: 6,
    });
  });
});

describe("pickOgSquareMode", () => {
  it("uses split for low-complexity auto mode", () => {
    const mode = pickOgSquareMode("auto", { activeCellCount: 80, segmentScore: 180 });
    expect(mode).toBe("split");
  });

  it("uses blend for high-complexity auto mode", () => {
    const byActiveCellCount = pickOgSquareMode("auto", { activeCellCount: 301, segmentScore: 200 });
    expect(byActiveCellCount).toBe("blend");

    const bySegmentScore = pickOgSquareMode("auto", { activeCellCount: 100, segmentScore: 651 });
    expect(bySegmentScore).toBe("blend");
  });

  it("respects explicit mode overrides", () => {
    expect(pickOgSquareMode("split", { activeCellCount: 999, segmentScore: 999 })).toBe("split");
    expect(pickOgSquareMode("blend", { activeCellCount: 1, segmentScore: 1 })).toBe("blend");
  });
});

describe("parseOgSquareMode", () => {
  it("parses only supported values and defaults to auto", () => {
    expect(parseOgSquareMode("split")).toBe("split");
    expect(parseOgSquareMode("blend")).toBe("blend");
    expect(parseOgSquareMode("auto")).toBe("auto");
    expect(parseOgSquareMode("unexpected")).toBe("auto");
    expect(parseOgSquareMode(null)).toBe("auto");
  });
});
