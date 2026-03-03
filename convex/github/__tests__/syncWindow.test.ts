import { describe, expect, it } from "vitest";
import {
  computeRepoSinceMs,
  getTwoYearFloorMs,
  getUtcDayStart,
  getUtcWeekStart,
  INCREMENTAL_OVERLAP_MS,
  shouldQueueIncrementalRepo,
} from "../syncWindow";

describe("computeRepoSinceMs", () => {
  const now = Date.UTC(2026, 2, 3, 12, 0, 0); // 2026-03-03T12:00:00Z

  it("uses full 2-year floor when no lastSyncedAt exists", () => {
    expect(computeRepoSinceMs({ nowMs: now })).toBe(getTwoYearFloorMs(now));
  });

  it("uses full 2-year floor when full rebuild is forced", () => {
    const lastSyncedAt = Date.UTC(2026, 2, 2, 12, 0, 0);
    expect(computeRepoSinceMs({ nowMs: now, lastSyncedAt, forceFullResync: true })).toBe(
      getTwoYearFloorMs(now)
    );
  });

  it("uses overlap window for incremental sync", () => {
    const lastSyncedAt = Date.UTC(2026, 2, 2, 12, 0, 0);
    expect(computeRepoSinceMs({ nowMs: now, lastSyncedAt })).toBe(
      lastSyncedAt - INCREMENTAL_OVERLAP_MS
    );
  });

  it("clamps incremental window to 2-year floor", () => {
    const nearFloor = getTwoYearFloorMs(now) + 2 * 24 * 60 * 60 * 1000;
    expect(computeRepoSinceMs({ nowMs: now, lastSyncedAt: nearFloor })).toBe(
      getTwoYearFloorMs(now)
    );
  });
});

describe("shouldQueueIncrementalRepo", () => {
  it("queues when incoming pushedAt is missing", () => {
    expect(shouldQueueIncrementalRepo({ storedPushedAt: 100 })).toBe(true);
  });

  it("queues when stored pushedAt is missing", () => {
    expect(shouldQueueIncrementalRepo({ incomingPushedAt: 100 })).toBe(true);
  });

  it("queues when incoming pushedAt is newer", () => {
    expect(shouldQueueIncrementalRepo({ incomingPushedAt: 200, storedPushedAt: 100 })).toBe(true);
  });

  it("does not queue when incoming pushedAt is unchanged", () => {
    expect(shouldQueueIncrementalRepo({ incomingPushedAt: 200, storedPushedAt: 200 })).toBe(false);
  });
});

describe("UTC boundaries", () => {
  it("computes day start in UTC", () => {
    const ts = Date.UTC(2026, 2, 3, 18, 34, 12);
    expect(getUtcDayStart(ts)).toBe(Date.UTC(2026, 2, 3, 0, 0, 0, 0));
  });

  it("computes Monday week start in UTC", () => {
    const wednesday = Date.UTC(2026, 2, 4, 18, 34, 12); // Wed
    expect(getUtcWeekStart(wednesday)).toBe(Date.UTC(2026, 2, 2, 0, 0, 0, 0)); // Monday
  });
});
