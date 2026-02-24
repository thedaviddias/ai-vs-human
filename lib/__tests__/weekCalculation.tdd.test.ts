/**
 * TDD-style tests for week calculation functions.
 *
 * These tests verify ISO 8601 week numbering at year boundaries —
 * a notoriously tricky area where off-by-one errors hide.
 *
 * Key invariants:
 * 1. getWeekStart always returns a Monday at 00:00:00 UTC
 * 2. formatWeekLabel should produce valid ISO week labels (YYYY-Www)
 * 3. Year boundary: Dec 29-31 may belong to week 1 of NEXT year
 * 4. Year boundary: Jan 1-3 may belong to last week of PREVIOUS year
 */

import { describe, expect, it } from "vitest";
import { formatWeekLabel, getWeekStart } from "../utils";

describe("getWeekStart — year boundaries (TDD)", () => {
  it("Saturday Jan 1 2022 → Monday Dec 27 2021", () => {
    // Jan 1, 2022 is Saturday → week started on Monday Dec 27, 2021
    const jan1Sat = Date.UTC(2022, 0, 1);
    const result = new Date(getWeekStart(jan1Sat));
    expect(result.getUTCDay()).toBe(1); // Monday
    expect(result.toISOString()).toBe("2021-12-27T00:00:00.000Z");
  });

  it("Sunday Jan 2 2022 → Monday Dec 27 2021", () => {
    const jan2Sun = Date.UTC(2022, 0, 2);
    const result = new Date(getWeekStart(jan2Sun));
    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2021-12-27T00:00:00.000Z");
  });

  it("Friday Dec 31 2021 → Monday Dec 27 2021", () => {
    const dec31Fri = Date.UTC(2021, 11, 31);
    const result = new Date(getWeekStart(dec31Fri));
    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2021-12-27T00:00:00.000Z");
  });

  it("Monday Jan 3 2022 → Monday Jan 3 2022 (itself)", () => {
    const jan3Mon = Date.UTC(2022, 0, 3);
    const result = new Date(getWeekStart(jan3Mon));
    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2022-01-03T00:00:00.000Z");
  });

  it("Thursday Dec 29 2022 → Monday Dec 26 2022", () => {
    const dec29Thu = Date.UTC(2022, 11, 29);
    const result = new Date(getWeekStart(dec29Thu));
    expect(result.getUTCDay()).toBe(1);
    expect(result.toISOString()).toBe("2022-12-26T00:00:00.000Z");
  });
});

describe("formatWeekLabel — year boundaries (TDD)", () => {
  it("week label for Monday Jan 6 2025 is 2025-W02", () => {
    // Jan 6 2025 is a Monday, start of ISO week 2
    const jan6 = Date.UTC(2025, 0, 6);
    expect(formatWeekLabel(jan6)).toBe("2025-W02");
  });

  it("week label for Monday Dec 30 2024 is 2025-W01 (ISO year boundary)", () => {
    // Dec 30 2024 is Monday. In ISO 8601, this is W01 of 2025 because
    // Jan 1 2025 (Wednesday) falls in this week, and Thursday is in 2025.
    const dec30 = Date.UTC(2024, 11, 30);
    const label = formatWeekLabel(dec30);

    // Per ISO 8601: the week containing Jan 4 (always first week)
    // Dec 30 2024 Mon → Jan 5 2025 Sun = contains Jan 4 → W01 of 2025
    expect(label).toBe("2025-W01");
  });

  it("week label never exceeds W53", () => {
    // Test various year-end dates
    const dates = [
      Date.UTC(2025, 11, 29), // Mon Dec 29 2025
      Date.UTC(2024, 11, 30), // Mon Dec 30 2024
      Date.UTC(2023, 0, 2), // Mon Jan 2 2023
    ];

    for (const date of dates) {
      const label = formatWeekLabel(date);
      const weekNum = parseInt(label.split("-W")[1], 10);
      expect(weekNum).toBeLessThanOrEqual(53);
      expect(weekNum).toBeGreaterThanOrEqual(1);
    }
  });

  it("week label for Jan 1 2025 (Wednesday) should be W01 of 2025", () => {
    const jan1 = Date.UTC(2025, 0, 1);
    const label = formatWeekLabel(jan1);
    // Jan 1, 2025 is a Wednesday. It's in ISO week 1 of 2025.
    expect(label).toBe("2025-W01");
  });
});
