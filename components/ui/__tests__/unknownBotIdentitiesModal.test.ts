import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getUnknownBotMappingSuggestion,
  getUnknownBotModalBots,
  UnknownBotIdentitiesModal,
} from "../UnknownBotIdentitiesModal";

describe("UnknownBotIdentitiesModal helpers", () => {
  it("filters to actionable unknown bots only", () => {
    const result = getUnknownBotModalBots([
      { key: "other-bot", label: "Unknown Automation Bot", commits: 10 },
      { key: "bot-unspecified", label: "Unknown Automation Bot", commits: 4 },
      { key: "bot-internal-helper-bot", label: "Internal Helper Bot", commits: 2 },
    ]);

    expect(result).toEqual([
      { key: "bot-internal-helper-bot", label: "Internal Helper Bot", commits: 2 },
    ]);
  });

  it("returns mapping snippets for a selected actionable identity", () => {
    const suggestion = getUnknownBotMappingSuggestion(
      [{ key: "bot-internal-helper-bot", label: "Internal Helper Bot", commits: 2 }],
      "bot-internal-helper-bot"
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.detailedBreakdownSnippet).toContain('key: "internal-helper-bot"');
    expect(suggestion?.knownBotsSnippet).toContain('classification: "other-bot"');
  });
});

describe("UnknownBotIdentitiesModal rendering", () => {
  it("does not render legacy aggregate warning copy", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnknownBotIdentitiesModal, {
        isOpen: true,
        onClose: () => {},
        bots: [
          { key: "other-bot", label: "Unknown Automation Bot", commits: 7 },
          { key: "bot-unspecified", label: "Unknown Automation Bot", commits: 3 },
          { key: "bot-internal-helper-bot", label: "Internal Helper Bot", commits: 2 },
        ],
      })
    );

    expect(html).toContain("Internal Helper Bot");
    expect(html).not.toContain("legacy aggregate bucket");
    expect(html).not.toContain("raw identity string preserved");
  });

  it("renders mapping suggestion snippets when a bot is pre-selected", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnknownBotIdentitiesModal, {
        isOpen: true,
        onClose: () => {},
        bots: [{ key: "bot-internal-helper-bot", label: "Internal Helper Bot", commits: 2 }],
        initialSelectedBotKey: "bot-internal-helper-bot",
      })
    );

    expect(html).toContain("Mapping Suggestion");
    expect(html).toContain("internal-helper-bot");
    expect(html).toContain("other-bot");
  });
});
