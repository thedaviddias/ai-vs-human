import {
  type DailySourceSnapshotUpload,
  validateDailySourceSnapshotUpload,
} from "@aivshuman/source-contract";
import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { verifyDesktopBearerToken } from "@/lib/server/desktopAuth";

const MAX_ROWS = 2000;
const MAX_METRIC_KEYS_PER_ROW = 32;

function dateStringToUtcEpochMs(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function enforcePayloadLimits(payload: DailySourceSnapshotUpload) {
  if (payload.rows.length > MAX_ROWS) {
    throw new Error(`Too many rows. Max allowed is ${MAX_ROWS}.`);
  }

  for (const row of payload.rows) {
    const keyCount = Object.keys(row.metrics).length;
    if (keyCount > MAX_METRIC_KEYS_PER_ROW) {
      throw new Error(
        `Row ${row.date} has too many metric keys. Max allowed is ${MAX_METRIC_KEYS_PER_ROW}.`
      );
    }
  }
}

export async function POST(request: Request) {
  let githubLogin: string;
  try {
    const verified = await verifyDesktopBearerToken(request.headers.get("authorization"));
    githubLogin = verified.githubLogin;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid desktop token.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = validateDailySourceSnapshotUpload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.value;

  try {
    enforcePayloadLimits(payload);

    const now = Date.now();
    const rows = payload.rows.map((row) => ({
      date: dateStringToUtcEpochMs(row.date),
      metrics: row.metrics,
    }));

    const result = await fetchMutation(api.mutations.sourceStats.replaceUserSourceDailySnapshot, {
      githubLogin,
      sourceId: payload.sourceId,
      schemaVersion: payload.schemaVersion,
      uploadedAt: now,
      clientVersion: payload.client.appVersion,
      rows,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload source stats.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
