import { afterEach, describe, expect, it } from "vitest";
import { hasValidAnalyzeApiKey } from "../analyzeApiKey";

const ORIGINAL_ANALYZE_API_KEY = process.env.ANALYZE_API_KEY;

afterEach(() => {
  if (typeof ORIGINAL_ANALYZE_API_KEY === "string") {
    process.env.ANALYZE_API_KEY = ORIGINAL_ANALYZE_API_KEY;
    return;
  }

  delete process.env.ANALYZE_API_KEY;
});

describe("hasValidAnalyzeApiKey", () => {
  it("rejects when ANALYZE_API_KEY is missing", () => {
    delete process.env.ANALYZE_API_KEY;
    expect(hasValidAnalyzeApiKey("any-value")).toBe(false);
  });

  it("rejects an invalid key", () => {
    process.env.ANALYZE_API_KEY = "expected-key";
    expect(hasValidAnalyzeApiKey("wrong-key")).toBe(false);
  });

  it("accepts the configured key", () => {
    process.env.ANALYZE_API_KEY = "expected-key";
    expect(hasValidAnalyzeApiKey("expected-key")).toBe(true);
  });
});
