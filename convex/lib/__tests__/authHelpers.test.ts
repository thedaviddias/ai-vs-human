import { describe, expect, it } from "vitest";
import { buildTrustedOrigins } from "../authHelpers";

describe("buildTrustedOrigins", () => {
  it("always includes the siteUrl itself", () => {
    const origins = buildTrustedOrigins("https://aivshuman.dev");
    expect(origins).toContain("https://aivshuman.dev");
  });

  it("includes localhost for local development", () => {
    const origins = buildTrustedOrigins("https://aivshuman.dev");
    expect(origins).toContain("http://localhost:3000");
  });

  it("includes 127.0.0.1 for local development", () => {
    const origins = buildTrustedOrigins("https://aivshuman.dev");
    expect(origins).toContain("http://127.0.0.1:3000");
  });

  it("includes Vercel preview deployment wildcard", () => {
    const origins = buildTrustedOrigins("https://aivshuman.dev");
    expect(origins.some((o: string) => o.includes("vercel.app"))).toBe(true);
  });

  it("deduplicates when siteUrl IS localhost:3000", () => {
    const origins = buildTrustedOrigins("http://localhost:3000");
    // Should not have localhost twice
    const localhostCount = origins.filter((o: string) => o === "http://localhost:3000").length;
    expect(localhostCount).toBe(1);
  });

  it("includes extra origins from comma-separated string", () => {
    const origins = buildTrustedOrigins(
      "https://aivshuman.dev",
      "https://staging.aivshuman.dev,https://custom.example.com"
    );
    expect(origins).toContain("https://staging.aivshuman.dev");
    expect(origins).toContain("https://custom.example.com");
  });

  it("handles empty extra origins gracefully", () => {
    const origins = buildTrustedOrigins("https://aivshuman.dev", "");
    expect(origins.length).toBeGreaterThanOrEqual(3); // siteUrl + localhost + vercel
  });

  it("handles undefined extra origins", () => {
    const origins = buildTrustedOrigins("https://aivshuman.dev", undefined);
    expect(origins.length).toBeGreaterThanOrEqual(3);
  });

  it("trims whitespace from extra origins", () => {
    const origins = buildTrustedOrigins(
      "https://aivshuman.dev",
      "  https://staging.aivshuman.dev  , https://test.example.com  "
    );
    expect(origins).toContain("https://staging.aivshuman.dev");
    expect(origins).toContain("https://test.example.com");
  });

  it("ignores empty entries in comma-separated extra origins", () => {
    const origins = buildTrustedOrigins("https://aivshuman.dev", "https://a.com,,, ,https://b.com");
    expect(origins).toContain("https://a.com");
    expect(origins).toContain("https://b.com");
    // Should not contain empty strings
    expect(origins.every((o: string) => o.length > 0)).toBe(true);
  });

  it("deduplicates extra origins against default origins", () => {
    const origins = buildTrustedOrigins(
      "https://aivshuman.dev",
      "http://localhost:3000,https://aivshuman.dev"
    );
    const localhostCount = origins.filter((o: string) => o === "http://localhost:3000").length;
    const siteUrlCount = origins.filter((o: string) => o === "https://aivshuman.dev").length;
    expect(localhostCount).toBe(1);
    expect(siteUrlCount).toBe(1);
  });

  it("returns a plain array (not a Set)", () => {
    const origins = buildTrustedOrigins("https://aivshuman.dev");
    expect(Array.isArray(origins)).toBe(true);
  });
});
