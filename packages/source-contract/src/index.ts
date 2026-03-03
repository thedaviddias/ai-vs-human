export const SOURCE_SCHEMA_VERSION = 1 as const;

export type SourceId = "cursor";

export type DesktopClientPlatform = "macos" | "windows" | "linux";

export interface DailyMetricRow {
  date: string; // YYYY-MM-DD
  metrics: Record<string, number>;
}

export interface DailySourceSnapshotUpload {
  sourceId: SourceId;
  schemaVersion: number;
  isFullSnapshot: true;
  timezone: string;
  rows: DailyMetricRow[];
  client: {
    appVersion: string;
    platform: DesktopClientPlatform;
  };
}

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

const SOURCE_IDS: SourceId[] = ["cursor"];

const PLATFORMS: DesktopClientPlatform[] = ["macos", "windows", "linux"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidDateString(value: string): boolean {
  if (!YYYY_MM_DD.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() + 1 === month && utc.getUTCDate() === day
  );
}

export function validateDailySourceSnapshotUpload(
  input: unknown
): { ok: true; value: DailySourceSnapshotUpload } | { ok: false; error: string } {
  if (!isObject(input)) {
    return { ok: false, error: "Payload must be an object." };
  }

  const sourceId = input.sourceId;
  if (typeof sourceId !== "string" || !SOURCE_IDS.includes(sourceId as SourceId)) {
    return { ok: false, error: "Invalid sourceId." };
  }

  const schemaVersion = input.schemaVersion;
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return { ok: false, error: "Invalid schemaVersion." };
  }

  if (input.isFullSnapshot !== true) {
    return { ok: false, error: "isFullSnapshot must be true." };
  }

  if (
    typeof input.timezone !== "string" ||
    input.timezone.length < 1 ||
    input.timezone.length > 120
  ) {
    return { ok: false, error: "Invalid timezone." };
  }

  if (!isObject(input.client)) {
    return { ok: false, error: "client must be an object." };
  }

  const appVersion = input.client.appVersion;
  const platform = input.client.platform;
  if (typeof appVersion !== "string" || appVersion.length < 1 || appVersion.length > 64) {
    return { ok: false, error: "Invalid client.appVersion." };
  }
  if (typeof platform !== "string" || !PLATFORMS.includes(platform as DesktopClientPlatform)) {
    return { ok: false, error: "Invalid client.platform." };
  }

  if (!Array.isArray(input.rows)) {
    return { ok: false, error: "rows must be an array." };
  }

  const rows: DailyMetricRow[] = [];

  for (const row of input.rows) {
    if (!isObject(row)) {
      return { ok: false, error: "Each row must be an object." };
    }

    if (typeof row.date !== "string" || !isValidDateString(row.date)) {
      return { ok: false, error: "Each row.date must be a valid YYYY-MM-DD string." };
    }

    if (!isObject(row.metrics)) {
      return { ok: false, error: "Each row.metrics must be an object." };
    }

    const metrics: Record<string, number> = {};
    for (const [key, value] of Object.entries(row.metrics)) {
      if (typeof key !== "string" || key.length < 1 || key.length > 64) {
        return { ok: false, error: "Invalid metric key." };
      }
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return { ok: false, error: `Invalid metric value for ${key}.` };
      }
      metrics[key] = value;
    }

    rows.push({ date: row.date, metrics });
  }

  return {
    ok: true,
    value: {
      sourceId: sourceId as SourceId,
      schemaVersion,
      isFullSnapshot: true,
      timezone: input.timezone,
      rows,
      client: {
        appVersion,
        platform: platform as DesktopClientPlatform,
      },
    },
  };
}
