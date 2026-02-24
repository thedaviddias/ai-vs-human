import { afterEach, describe, expect, it, vi } from "vitest";
import { cn, formatWeekLabel, getBaseUrl, getWeekStart } from "../utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates Tailwind classes (tailwind-merge)", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null values", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });
});

describe("getBaseUrl", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("returns window.location.origin in browser context", () => {
    vi.stubGlobal("window", { location: { origin: "https://example.com" } });
    expect(getBaseUrl()).toBe("https://example.com");
  });

  it("returns NEXT_PUBLIC_SITE_URL when set (server-side)", () => {
    // Ensure no window
    vi.stubGlobal("window", undefined);
    process.env.NEXT_PUBLIC_SITE_URL = "https://mysite.com";
    expect(getBaseUrl()).toBe("https://mysite.com");
  });

  it("returns VERCEL_URL with https prefix when set", () => {
    vi.stubGlobal("window", undefined);
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_URL = "my-app.vercel.app";
    expect(getBaseUrl()).toBe("https://my-app.vercel.app");
  });

  it("falls back to localhost with PORT", () => {
    vi.stubGlobal("window", undefined);
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    process.env.PORT = "4000";
    expect(getBaseUrl()).toBe("http://localhost:4000");
  });

  it("falls back to localhost:3000 when no env vars set", () => {
    vi.stubGlobal("window", undefined);
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.PORT;
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });
});

describe("getWeekStart", () => {
  it("returns Monday for a Wednesday", () => {
    // 2025-01-08 is Wednesday → Monday = 2025-01-06
    const wednesday = Date.UTC(2025, 0, 8, 12, 0, 0);
    const result = new Date(getWeekStart(wednesday));
    expect(result.getUTCDay()).toBe(1); // Monday
    expect(result.toISOString()).toBe("2025-01-06T00:00:00.000Z");
  });

  it("returns same day for a Monday", () => {
    const monday = Date.UTC(2025, 0, 6, 15, 30, 0);
    const result = new Date(getWeekStart(monday));
    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2025-01-06T00:00:00.000Z");
  });

  it("returns previous Monday for a Sunday", () => {
    // 2025-01-12 is Sunday → Monday = 2025-01-06
    const sunday = Date.UTC(2025, 0, 12, 8, 0, 0);
    const result = new Date(getWeekStart(sunday));
    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2025-01-06T00:00:00.000Z");
  });

  it("zeroes out hours, minutes, seconds, ms", () => {
    const ts = Date.UTC(2025, 5, 18, 14, 35, 22, 999); // Wednesday
    const result = new Date(getWeekStart(ts));
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });
});

describe("formatWeekLabel", () => {
  it("formats a known Monday to ISO week label", () => {
    // 2025-01-06 is ISO week 2 (W02)
    const monday = Date.UTC(2025, 0, 6);
    expect(formatWeekLabel(monday)).toMatch(/^2025-W\d{2}$/);
  });

  it("pads single-digit week numbers", () => {
    // First week of 2025
    const jan1 = Date.UTC(2025, 0, 1);
    const label = formatWeekLabel(jan1);
    expect(label).toMatch(/^2025-W0[1-9]$/);
  });

  it("handles end-of-year weeks (ISO year may differ from calendar year)", () => {
    // Dec 29, 2025 is a Monday. Its Thursday is Jan 1, 2026,
    // so ISO week-numbering year is 2026, week 1.
    const dec29 = Date.UTC(2025, 11, 29);
    const label = formatWeekLabel(dec29);
    expect(label).toBe("2026-W01");
  });
});
