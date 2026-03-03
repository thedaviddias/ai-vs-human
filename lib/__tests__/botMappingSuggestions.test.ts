import { describe, expect, it } from "vitest";
import { buildBotDetectionRegexSource, createBotMappingSuggestion } from "../botMappingSuggestions";

describe("createBotMappingSuggestion", () => {
  it("produces stable snippets for internal helper bot identities", () => {
    const suggestion = createBotMappingSuggestion({
      key: "bot-internal-helper-bot",
      label: "Internal Helper Bot",
    });

    expect(suggestion.normalizedKey).toBe("internal-helper-bot");
    expect(suggestion.regexSource).toBe("internal[-_ ]?helper[-_ ]?bot");
    expect(suggestion.detailedBreakdownSnippet).toBe(
      '{ pattern: /internal[-_ ]?helper[-_ ]?bot/i, match: { key: "internal-helper-bot", label: "Internal Helper Bot" } },'
    );
    expect(suggestion.knownBotsSnippet).toBe(
      '{ pattern: /internal[-_ ]?helper[-_ ]?bot/i, classification: "other-bot" },'
    );
  });

  it("handles mixed separators and numbers deterministically", () => {
    const regexSource = buildBotDetectionRegexSource({
      key: "bot-ci-v2_runner",
      label: "CI v2 Runner",
    });

    expect(regexSource).toBe("ci[-_ ]?v2[-_ ]?runner");
  });
});
