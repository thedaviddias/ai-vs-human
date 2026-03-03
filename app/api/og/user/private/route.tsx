import { fetchQuery } from "convex/nextjs";
import { ImageResponse } from "next/og";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";
import { buildOgHeatmapGrid, parseOgSquareMode, pickOgSquareMode } from "@/lib/og/squareRendering";
import { renderUserOgImage, USER_OG_WEEKS_TO_SHOW } from "@/lib/og/userOgImage";

export const runtime = "edge";

/**
 * Private OG image route: generates a user card that includes
 * both public AND private repo activity merged together.
 *
 * Used by the profile owner to download/copy a card with their full
 * activity for personal sharing on social media.
 *
 * Security note: this route returns only aggregate numbers (commit
 * counts and percentages) — no repo names, code, or commit messages.
 * The privacy toggle on the profile page controls what visitors see
 * in the browser, not what this image endpoint returns.
 *
 * Cache: private, no-store — private images must never be CDN-cached.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const requestedSquareMode = parseOgSquareMode(searchParams.get("squareMode"));

    if (!owner) {
      return new Response("Missing owner", { status: 400 });
    }

    // Fetch user data with private stats merged in
    const [user, githubUser] = await Promise.all([
      fetchQuery(api.queries.users.getUserByOwnerWithPrivateData, { owner }),
      fetch(`https://api.github.com/users/${owner}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ name: string | null }>) : null))
        .catch((err) => {
          logger.warn("GitHub fetch failed in private OG route", { error: String(err), owner });
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
    const { complexity } = buildOgHeatmapGrid({
      dailyData: user.dailyData,
      weeksToShow: USER_OG_WEEKS_TO_SHOW,
    });
    const selectedSquareMode = pickOgSquareMode(requestedSquareMode, complexity);
    logger.info("OG private user square mode selected", {
      owner,
      requestedMode: requestedSquareMode,
      selectedMode: selectedSquareMode,
      complexity,
    });

    const imageHeaders = {
      "cache-control": "private, no-store",
    };
    const renderImage = (squareMode: "split" | "blend") =>
      new ImageResponse(renderUserOgImage({ user, displayName, squareMode }), {
        width: 1200,
        height: 630,
        headers: imageHeaders,
      });
    const renderBufferedImage = async (squareMode: "split" | "blend") => {
      const image = renderImage(squareMode);
      const png = await image.arrayBuffer();
      return new Response(png, {
        headers: {
          "content-type": "image/png",
          ...imageHeaders,
        },
      });
    };

    try {
      return await renderBufferedImage(selectedSquareMode);
    } catch (renderError) {
      if (selectedSquareMode === "split") {
        logger.warn("OG private user split rendering failed, retrying with blend", {
          owner,
          requestedMode: requestedSquareMode,
          complexity,
          error: String(renderError),
        });
        return await renderBufferedImage("blend");
      }
      throw renderError;
    }
  } catch (e) {
    logger.error("Private OG user image generation failed", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
