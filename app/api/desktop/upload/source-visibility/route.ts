import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { verifyDesktopBearerToken } from "@/lib/server/desktopAuth";

interface VisibilityRequestBody {
  showSourceStatsPublicly?: boolean;
}

async function requireDesktopLogin(request: Request): Promise<string> {
  const verified = await verifyDesktopBearerToken(request.headers.get("authorization"));
  return verified.githubLogin;
}

export async function GET(request: Request) {
  let githubLogin: string;
  try {
    githubLogin = await requireDesktopLogin(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid desktop token.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const profile = await fetchQuery(api.queries.users.getProfile, { owner: githubLogin });
    return NextResponse.json({
      showSourceStatsPublicly: profile?.showSourceStatsPublicly === true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read source visibility.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let githubLogin: string;
  try {
    githubLogin = await requireDesktopLogin(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid desktop token.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  let body: VisibilityRequestBody;
  try {
    body = (await request.json()) as VisibilityRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.showSourceStatsPublicly !== "boolean") {
    return NextResponse.json(
      { error: "showSourceStatsPublicly must be a boolean." },
      { status: 400 }
    );
  }

  try {
    // biome-ignore lint/suspicious/noExplicitAny: local Convex codegen is unavailable in this environment; use dynamic internal API reference.
    const internalApi = api as any;
    const result = await fetchMutation(
      internalApi.internal.mutations.updateSourceStatsVisibility.setSourceStatsVisibilityByLogin,
      {
        githubLogin,
        showSourceStatsPublicly: body.showSourceStatsPublicly,
      }
    );

    return NextResponse.json({
      success: result.success,
      showSourceStatsPublicly: result.showSourceStatsPublicly,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update source visibility.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
