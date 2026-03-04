import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { verifyDesktopBearerToken } from "@/lib/server/desktopAuth";

export async function GET(request: Request) {
  let githubLogin: string;
  try {
    const verified = await verifyDesktopBearerToken(request.headers.get("authorization"));
    githubLogin = verified.githubLogin;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid desktop token.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const stats = await fetchQuery(api.queries.users.getDesktopUserStats, {
      owner: githubLogin,
    });

    return NextResponse.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch user stats.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
