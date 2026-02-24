import { afterEach, describe, expect, it } from "vitest";
import { getAnalyzeApiKey } from "../server/analyzeApiKey";

describe("getAnalyzeApiKey", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the API key when set", () => {
    process.env.ANALYZE_API_KEY = "sk-test-123";
    expect(getAnalyzeApiKey()).toBe("sk-test-123");
  });

  it("trims whitespace from the key", () => {
    process.env.ANALYZE_API_KEY = "  sk-test-456  ";
    expect(getAnalyzeApiKey()).toBe("sk-test-456");
  });

  it("returns null when env var is missing", () => {
    delete process.env.ANALYZE_API_KEY;
    expect(getAnalyzeApiKey()).toBeNull();
  });

  it("returns null when env var is empty string", () => {
    process.env.ANALYZE_API_KEY = "";
    expect(getAnalyzeApiKey()).toBeNull();
  });

  it("returns null when env var is only whitespace", () => {
    process.env.ANALYZE_API_KEY = "   ";
    expect(getAnalyzeApiKey()).toBeNull();
  });
});
