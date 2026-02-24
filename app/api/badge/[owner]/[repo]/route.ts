import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await params;
    if (!owner || !repo) return new Response("Missing parameters", { status: 400 });

    const fullName = `${owner}/${repo}`;
    const summary = await fetchQuery(api.queries.stats.getRepoSummary, {
      repoFullName: fullName,
    });

    if (!summary) {
      return new Response("Repo not found", { status: 404 });
    }

    // Determine stats
    const humanPct = summary.locHumanPercentage
      ? Number.parseFloat(summary.locHumanPercentage)
      : Number.parseFloat(summary.humanPercentage);

    const isHumanDominant = humanPct >= 50;
    const percentage = isHumanDominant ? humanPct : (100 - humanPct).toFixed(1);
    const label = isHumanDominant ? "Human" : "AI";
    const color = isHumanDominant ? "#4ade80" : "#a78bfa";
    const message = `${percentage}% ${label}`;

    const labelWidth = 84;
    const messageWidth = message.length * 7 + 20;
    const totalWidth = labelWidth + messageWidth;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
        <linearGradient id="b" x2="0" y2="100%">
          <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
          <stop offset="1" stop-opacity=".1"/>
        </linearGradient>
        <mask id="a">
          <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
        </mask>
        <g mask="url(#a)">
          <path fill="#555" d="M0 0h${labelWidth}v20H0z"/>
          <path fill="${color}" d="M${labelWidth} 0h${messageWidth}v20H${labelWidth}z"/>
          <path fill="url(#b)" d="M0 0h${totalWidth}v20H0z"/>
        </g>
        <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu,sans-serif" font-size="11">
          <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">AI vs Human</text>
          <text x="${labelWidth / 2}" y="14">AI vs Human</text>
          <text x="${labelWidth + messageWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
          <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
        </g>
      </svg>
    `;

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e) {
    logger.error("Badge generation failed", e);
    return new Response("Failed to generate badge", { status: 500 });
  }
}
