import { describe, expect, it } from "vitest";
import { extractRateLimitInfo, getGitHubHeaders, getRetryDelayMs } from "../githubApi";

// ─── Test helpers ──────────────────────────────────────────────────────

/** Builds a minimal Response with configurable headers and status. */
function makeResponse(opts: {
  status?: number;
  remaining?: string | null;
  reset?: string | null;
}): Response {
  const headers = new Headers();
  if (opts.remaining !== undefined && opts.remaining !== null) {
    headers.set("X-RateLimit-Remaining", opts.remaining);
  }
  if (opts.reset !== undefined && opts.reset !== null) {
    headers.set("X-RateLimit-Reset", opts.reset);
  }
  return new Response(null, { status: opts.status ?? 200, headers });
}

// ─── extractRateLimitInfo ──────────────────────────────────────────────

describe("extractRateLimitInfo", () => {
  describe("rate-limited responses (403 + remaining=0)", () => {
    it("detects rate limit when status=403 and remaining=0", () => {
      const resetEpoch = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const info = extractRateLimitInfo(
        makeResponse({ status: 403, remaining: "0", reset: String(resetEpoch) })
      );
      expect(info.isRateLimited).toBe(true);
      expect(info.remaining).toBe(0);
      expect(info.resetAt).toBe(resetEpoch * 1000);
    });

    it("not rate-limited when 403 but remaining > 0", () => {
      const info = extractRateLimitInfo(
        makeResponse({ status: 403, remaining: "100", reset: "1700000000" })
      );
      expect(info.isRateLimited).toBe(false);
      expect(info.remaining).toBe(100);
    });

    it("not rate-limited when 403 but remaining header missing", () => {
      const info = extractRateLimitInfo(makeResponse({ status: 403 }));
      expect(info.isRateLimited).toBe(false);
      expect(info.remaining).toBeNull();
    });
  });

  describe("successful responses", () => {
    it("parses remaining and reset from a 200 response", () => {
      const info = extractRateLimitInfo(
        makeResponse({ status: 200, remaining: "4999", reset: "1700000000" })
      );
      expect(info.isRateLimited).toBe(false);
      expect(info.remaining).toBe(4999);
      expect(info.resetAt).toBe(1700000000000);
    });

    it("handles missing headers on a 200 response", () => {
      const info = extractRateLimitInfo(makeResponse({ status: 200 }));
      expect(info.isRateLimited).toBe(false);
      expect(info.remaining).toBeNull();
      expect(info.resetAt).toBeNull();
    });
  });

  describe("other error statuses", () => {
    it("not rate-limited on 401 even with remaining=0", () => {
      const info = extractRateLimitInfo(
        makeResponse({ status: 401, remaining: "0", reset: "1700000000" })
      );
      expect(info.isRateLimited).toBe(false);
    });

    it("not rate-limited on 404", () => {
      const info = extractRateLimitInfo(makeResponse({ status: 404 }));
      expect(info.isRateLimited).toBe(false);
    });

    it("not rate-limited on 500", () => {
      const info = extractRateLimitInfo(makeResponse({ status: 500, remaining: "0" }));
      expect(info.isRateLimited).toBe(false);
    });
  });
});

// ─── getRetryDelayMs ───────────────────────────────────────────────────

describe("getRetryDelayMs", () => {
  it("returns delay based on resetAt time", () => {
    const futureMs = Date.now() + 30_000; // 30s from now
    const delay = getRetryDelayMs({
      remaining: 0,
      resetAt: futureMs,
      isRateLimited: true,
    });
    // Should be ~31s (30s + 1s buffer)
    expect(delay).toBeGreaterThan(29_000);
    expect(delay).toBeLessThan(33_000);
  });

  it("returns at least 1s even if reset time is in the past", () => {
    const pastMs = Date.now() - 10_000;
    const delay = getRetryDelayMs({
      remaining: 0,
      resetAt: pastMs,
      isRateLimited: true,
    });
    expect(delay).toBe(1_000);
  });

  it("returns 60s fallback when resetAt is null", () => {
    const delay = getRetryDelayMs({
      remaining: 0,
      resetAt: null,
      isRateLimited: true,
    });
    expect(delay).toBe(60_000);
  });
});

// ─── getGitHubHeaders ──────────────────────────────────────────────────

describe("getGitHubHeaders", () => {
  it("returns Authorization and Accept headers", () => {
    const headers = getGitHubHeaders("ghp_test123");
    expect(headers.Authorization).toBe("token ghp_test123");
    expect(headers.Accept).toBe("application/vnd.github.v3+json");
  });

  it("uses the exact token value provided", () => {
    const headers = getGitHubHeaders("my-secret-token");
    expect(headers.Authorization).toBe("token my-secret-token");
  });
});
