import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { getAuthServer } from "@/lib/auth-server";
import { hashDeviceCode } from "@/lib/server/desktopAuth";

interface CompleteRequestBody {
  deviceCode?: string;
}

export async function POST(request: Request) {
  let body: CompleteRequestBody;
  try {
    body = (await request.json()) as CompleteRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const deviceCode = body.deviceCode?.trim();
  if (!deviceCode) {
    return NextResponse.json({ error: "deviceCode is required." }, { status: 400 });
  }

  let githubLogin: string | null = null;
  try {
    githubLogin = await getAuthServer().fetchAuthQuery(api.auth.getMyGitHubLogin, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to authenticate user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!githubLogin) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const codeHash = hashDeviceCode(deviceCode);
    const result = await fetchMutation(api.mutations.desktopDeviceLinks.completeDesktopDeviceLink, {
      codeHash,
      githubLogin,
      now: Date.now(),
    });

    if (result.status === "approved") {
      return NextResponse.json({ status: "approved" as const });
    }

    if (result.status === "expired") {
      return NextResponse.json({ error: "Device link has expired." }, { status: 410 });
    }

    if (result.status === "consumed") {
      return NextResponse.json({ error: "Device link has already been used." }, { status: 409 });
    }

    return NextResponse.json({ error: "Invalid device link code." }, { status: 404 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to complete desktop device link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
