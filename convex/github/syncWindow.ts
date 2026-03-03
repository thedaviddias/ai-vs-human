const DAY_MS = 24 * 60 * 60 * 1000;
export const INCREMENTAL_OVERLAP_MS = 7 * DAY_MS;

/** Returns the UTC timestamp exactly 2 years before `nowMs`. */
export function getTwoYearFloorMs(nowMs: number = Date.now()): number {
  const floor = new Date(nowMs);
  floor.setUTCFullYear(floor.getUTCFullYear() - 2);
  return floor.getTime();
}

/**
 * Computes the commit-fetch lower bound for a repo sync.
 *
 * - Full rebuild or first sync: full 2-year window
 * - Incremental: lastSyncedAt minus overlap, clamped to 2-year floor
 */
export function computeRepoSinceMs({
  lastSyncedAt,
  forceFullResync = false,
  nowMs = Date.now(),
}: {
  lastSyncedAt?: number;
  forceFullResync?: boolean;
  nowMs?: number;
}): number {
  const twoYearFloorMs = getTwoYearFloorMs(nowMs);
  if (forceFullResync || !lastSyncedAt) {
    return twoYearFloorMs;
  }
  return Math.max(lastSyncedAt - INCREMENTAL_OVERLAP_MS, twoYearFloorMs);
}

export function toIsoTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/** Monday 00:00:00 UTC for the given timestamp. */
export function getUtcWeekStart(epochMs: number): number {
  const date = new Date(epochMs);
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

/** 00:00:00 UTC for the given timestamp. */
export function getUtcDayStart(epochMs: number): number {
  const day = new Date(epochMs);
  day.setUTCHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * Whether an existing synced repo should be queued for incremental sync.
 *
 * Missing incoming pushedAt is treated as changed to avoid missing updates.
 */
export function shouldQueueIncrementalRepo({
  incomingPushedAt,
  storedPushedAt,
}: {
  incomingPushedAt?: number;
  storedPushedAt?: number;
}): boolean {
  if (incomingPushedAt === undefined) return true;
  if (storedPushedAt === undefined) return true;
  return incomingPushedAt > storedPushedAt;
}
