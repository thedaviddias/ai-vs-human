import { describe, expect, it } from "vitest";
import { evaluateResyncThrottle, RESYNC_COOLDOWN_MS, RESYNC_DAILY_LIMIT } from "../resyncThrottle";

describe("evaluateResyncThrottle", () => {
  it("allows the first resync attempt", () => {
    const now = Date.UTC(2026, 1, 25, 10, 0, 0);
    const result = evaluateResyncThrottle({ now });

    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
    expect(result.dayCount).toBe(1);
  });

  it("rejects a second attempt during cooldown with retryAfter", () => {
    const now = Date.UTC(2026, 1, 25, 10, 0, 0);
    const first = evaluateResyncThrottle({ now });
    if (!first.allowed) {
      throw new Error("Expected first resync to be allowed");
    }

    const second = evaluateResyncThrottle({
      now: now + 60 * 1000,
      state: {
        lastResyncAt: first.lastResyncAt,
        dayKey: first.dayKey,
        dayCount: first.dayCount,
      },
    });

    expect(second.allowed).toBe(false);
    expect(second.reason).toBe("cooldown");
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
    expect(second.retryAfterSeconds).toBeLessThanOrEqual(9 * 60);
  });

  it("allows requests after cooldown elapses", () => {
    const now = Date.UTC(2026, 1, 25, 10, 0, 0);
    const first = evaluateResyncThrottle({ now });
    if (!first.allowed) {
      throw new Error("Expected first resync to be allowed");
    }

    const next = evaluateResyncThrottle({
      now: now + RESYNC_COOLDOWN_MS,
      state: {
        lastResyncAt: first.lastResyncAt,
        dayKey: first.dayKey,
        dayCount: first.dayCount,
      },
    });

    expect(next.allowed).toBe(true);
    expect(next.dayCount).toBe(2);
  });

  it("rejects the seventh request in the same UTC day", () => {
    const now = Date.UTC(2026, 1, 25, 20, 0, 0);
    const result = evaluateResyncThrottle({
      now,
      state: {
        lastResyncAt: now - RESYNC_COOLDOWN_MS,
        dayKey: "2026-02-25",
        dayCount: RESYNC_DAILY_LIMIT,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("daily_cap");
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets day count on the next UTC day", () => {
    const nextDay = Date.UTC(2026, 1, 26, 0, 1, 0);
    const result = evaluateResyncThrottle({
      now: nextDay,
      state: {
        lastResyncAt: Date.UTC(2026, 1, 25, 23, 40, 0),
        dayKey: "2026-02-25",
        dayCount: RESYNC_DAILY_LIMIT,
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.dayKey).toBe("2026-02-26");
    expect(result.dayCount).toBe(1);
  });
});
