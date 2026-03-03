import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { hashDeviceCode, signDesktopToken } from "@/lib/server/desktopAuth";

interface PollRequestBody {
  deviceCode?: string;
}

export async function POST(request: Request) {
  let body: PollRequestBody;
  try {
    body = (await request.json()) as PollRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const deviceCode = body.deviceCode?.trim();
  if (!deviceCode) {
    return NextResponse.json({ error: "deviceCode is required." }, { status: 400 });
  }

  try {
    const codeHash = hashDeviceCode(deviceCode);
    const result = await fetchMutation(api.mutations.desktopDeviceLinks.pollDesktopDeviceLink, {
      codeHash,
      now: Date.now(),
    });

    if (result.status === "pending") {
      return NextResponse.json({ status: "pending" as const });
    }

    if (result.status === "expired") {
      return NextResponse.json({ status: "expired" as const });
    }

    if (result.status === "approved" && result.githubLogin) {
      const token = await signDesktopToken({ githubLogin: result.githubLogin });
      return NextResponse.json({ status: "approved" as const, token });
    }

    return NextResponse.json({ status: "invalid" as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to poll desktop device link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
