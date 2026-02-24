import { describe, expect, it } from "vitest";
import { getRank, RANKS } from "../ranks";

describe("RANKS", () => {
  it("contains exactly 5 rank tiers", () => {
    expect(RANKS).toHaveLength(5);
  });

  it("each rank has required fields", () => {
    for (const rank of RANKS) {
      expect(rank).toHaveProperty("title");
      expect(rank).toHaveProperty("description");
      expect(rank).toHaveProperty("color");
      expect(rank).toHaveProperty("hex");
      expect(rank).toHaveProperty("icon");
      expect(rank.title).toBeTruthy();
      expect(rank.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("getRank", () => {
  it("returns Organic Architect for 100% human", () => {
    expect(getRank(100).title).toBe("Organic Architect");
  });

  it("returns Organic Architect at the 95% boundary", () => {
    expect(getRank(95).title).toBe("Organic Architect");
  });

  it("returns Augmented Developer at 94%", () => {
    expect(getRank(94).title).toBe("Augmented Developer");
  });

  it("returns Augmented Developer at 80%", () => {
    expect(getRank(80).title).toBe("Augmented Developer");
  });

  it("returns Cyborg Coder at 79%", () => {
    expect(getRank(79).title).toBe("Cyborg Coder");
  });

  it("returns Cyborg Coder at 50%", () => {
    expect(getRank(50).title).toBe("Cyborg Coder");
  });

  it("returns AI Pilot at 49%", () => {
    expect(getRank(49).title).toBe("AI Pilot");
  });

  it("returns AI Pilot at 20%", () => {
    expect(getRank(20).title).toBe("AI Pilot");
  });

  it("returns Digital Overseer at 19%", () => {
    expect(getRank(19).title).toBe("Digital Overseer");
  });

  it("returns Digital Overseer at 0%", () => {
    expect(getRank(0).title).toBe("Digital Overseer");
  });

  it("each rank references a valid RANKS entry", () => {
    const percentages = [100, 95, 80, 50, 20, 0];
    for (const pct of percentages) {
      expect(RANKS).toContain(getRank(pct));
    }
  });
});
