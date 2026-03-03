import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  buildDesktopVerificationUrl,
  createDeviceCode,
  hashDeviceCode,
} from "@/lib/server/desktopAuth";

const DEVICE_LINK_TTL_MS = 10 * 60 * 1000;
const POLL_INTERVAL_SEC = 3;

export async function POST(request: Request) {
  try {
    const now = Date.now();
    const deviceCode = createDeviceCode();
    const codeHash = hashDeviceCode(deviceCode);
    const expiresAt = now + DEVICE_LINK_TTL_MS;

    await fetchMutation(api.mutations.desktopDeviceLinks.createDesktopDeviceLink, {
      codeHash,
      now,
      expiresAt,
    });

    const requestUrl = new URL(request.url);
    const verificationUrl = buildDesktopVerificationUrl(requestUrl, deviceCode);

    return NextResponse.json({
      deviceCode,
      verificationUrl,
      expiresAt,
      pollIntervalSec: POLL_INTERVAL_SEC,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start desktop device link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
