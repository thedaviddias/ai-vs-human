import { describe, expect, it } from "vitest";
import { shouldRenderUnknownBotSection } from "../unknownBotSection";

describe("shouldRenderUnknownBotSection", () => {
  it("returns false when no actionable unknown bot identities exist", () => {
    expect(shouldRenderUnknownBotSection([])).toBe(false);
  });

  it("returns true when actionable unknown bot identities exist", () => {
    expect(
      shouldRenderUnknownBotSection([
        { key: "bot-internal-helper-bot", label: "Internal Helper Bot", commits: 4 },
      ])
    ).toBe(true);
  });
});
