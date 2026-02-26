import { fetchQuery } from "convex/nextjs";
import { ImageResponse } from "next/og";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";
import { renderUserOgImage } from "@/lib/og/userOgImage";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");

    if (!owner) {
      return new Response("Missing owner", { status: 400 });
    }

    // Parallel fetch: User stats from Convex + User profile from GitHub
    const [user, githubUser] = await Promise.all([
      fetchQuery(api.queries.users.getUserByOwner, { owner }),
      fetch(`https://api.github.com/users/${owner}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ name: string | null }>) : null))
        .catch((err) => {
          logger.warn("GitHub fetch failed in OG route", { error: String(err), owner });
          return null;
        }),
    ]);

    if (!user) {
      return new ImageResponse(
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            backgroundColor: "#050505",
            color: "#fff",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: "bold",
          }}
        >
          Analyzing @{owner}...
        </div>,
        { width: 1200, height: 630 }
      );
    }

    const displayName = githubUser?.name || user.owner;

    return new ImageResponse(renderUserOgImage({ user, displayName }), {
      width: 1200,
      height: 630,
      headers: {
        "cache-control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (e) {
    logger.error("OG user image generation failed", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
