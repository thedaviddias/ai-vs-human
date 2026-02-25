import { fetchQuery } from "convex/nextjs";
import { ImageResponse } from "next/og";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";
import { getRank } from "@/lib/ranks";

export const runtime = "edge";

// Heatmap constants
const CELL_SIZE = 16;
const CELL_GAP = 3;
const WEEKS_TO_SHOW = 52; // Full year

const COLORS_HUMAN = ["#064e3b", "#065f46", "#059669", "#10b981", "#34d399"];
const COLORS_AI = ["#4c1d95", "#5b21b6", "#7c3aed", "#8b5cf6", "#a78bfa"];
const COLORS_AUTOMATION = ["#78350f", "#92400e", "#b45309", "#d97706", "#f59e0b"];

function getSquareColor(
  human: number,
  ai: number,
  automation: number,
  maxActivity: number
): string | null {
  const total = human + ai + automation;
  if (total === 0) return null;
  let colorScale = COLORS_HUMAN;
  if (ai >= human && ai >= automation) colorScale = COLORS_AI;
  else if (automation >= human && automation >= ai) colorScale = COLORS_AUTOMATION;
  const index = Math.min(4, Math.floor((total / maxActivity) * 5));
  return colorScale[index];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");

    if (!owner) {
      return new Response("Missing owner", { status: 400 });
    }

    // Parallel fetch: User stats from Convex + User profile from GitHub (with timeout)
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

    // Accuracy helper: Ensure small non-zero values are not rounded to 0.0%
    const formatPct = (val: string | null | undefined) => {
      if (!val) return "0";
      const num = Number.parseFloat(val);
      if (num === 0) return "0";
      if (num < 0.1) {
        const formatted = num.toFixed(2);
        return formatted.endsWith("0") ? num.toFixed(1) : formatted;
      }
      return num.toFixed(1);
    };

    // Always use commit-based percentages on OG images
    const humanDisplayPercentage = formatPct(user.humanPercentage);
    const aiDisplayPercentage = formatPct(user.aiPercentage);
    const automationDisplayPercentage = formatPct(user.automationPercentage);

    // Calculate Rank
    const humanPct = Number.parseFloat(user.locHumanPercentage ?? user.humanPercentage);
    const rank = getRank(humanPct);

    // Process heatmap data
    const dataMap = new Map();
    let maxActivity = 0;
    for (const p of user.dailyData) {
      dataMap.set(p.date, p);
      const total = p.human + p.ai + (p.automation ?? 0);
      if (total > maxActivity) maxActivity = total;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayDow = (today.getUTCDay() + 6) % 7; // Mon=0
    const totalDays = WEEKS_TO_SHOW * 7 + todayDow + 1;
    const startDate = new Date(today.getTime() - (totalDays - 1) * 86_400_000);

    const cells: ({ human: number; ai: number; automation: number } | null)[][] = Array.from(
      { length: WEEKS_TO_SHOW + 1 },
      () => Array.from({ length: 7 }, () => null)
    );

    for (let i = 0; i < totalDays; i++) {
      const cellDate = new Date(startDate.getTime() + i * 86_400_000);
      const dow = (cellDate.getUTCDay() + 6) % 7;
      const col = Math.floor(i / 7);
      if (col <= WEEKS_TO_SHOW) {
        cells[col][dow] = dataMap.get(cellDate.getTime()) || { human: 0, ai: 0, automation: 0 };
      }
    }

    const formatBigNumber = (n: number) => {
      if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
      if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
      return n.toString();
    };

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          padding: "32px 48px",
          color: "white",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "32px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "24px" }}>
            <img
              src={user.avatarUrl}
              alt={`${user.owner}'s avatar`}
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                border: "2px solid #333",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: "42px",
                  fontWeight: "bold",
                  color: "#4ade80",
                  letterSpacing: "-0.02em",
                }}
              >
                @{user.owner.toLowerCase()}
              </div>
              <div
                style={{ display: "flex", fontSize: "32px", color: "#a3a3a3", marginTop: "2px" }}
              >
                {displayName}
              </div>
            </div>
          </div>

          {/* Rank Badge */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "16px",
              backgroundColor: "#171717",
              padding: "16px 32px",
              borderRadius: "100px",
              border: "1px solid #404040",
            }}
          >
            <div style={{ display: "flex", fontSize: "42px" }}>{rank.icon}</div>
            <div
              style={{
                display: "flex",
                fontSize: "28px",
                fontWeight: "bold",
                color: rank.hex,
                letterSpacing: "-0.02em",
              }}
            >
              {rank.title}
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#171717",
            borderRadius: "24px",
            border: "1px solid #333",
            padding: "32px 48px",
            flex: 1,
            position: "relative",
          }}
        >
          {/* Top row: Big Stat & Percentages */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: "80px",
                  fontWeight: "bold",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                }}
              >
                {formatBigNumber(user.totalCommits)}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#a3a3a3",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginTop: "8px",
                }}
              >
                Contributions
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", gap: "32px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: "52px",
                    fontWeight: "bold",
                    color: "#4ade80",
                    lineHeight: 1,
                  }}
                >
                  {humanDisplayPercentage}%
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "20px",
                    color: "#a3a3a3",
                    fontWeight: "bold",
                    marginTop: "8px",
                  }}
                >
                  HUMAN
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: "52px",
                    fontWeight: "bold",
                    color: "#a78bfa",
                    lineHeight: 1,
                  }}
                >
                  {aiDisplayPercentage}%
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "20px",
                    color: "#a3a3a3",
                    fontWeight: "bold",
                    marginTop: "8px",
                  }}
                >
                  AI
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: "52px",
                    fontWeight: "bold",
                    color: "#f59e0b",
                    lineHeight: 1,
                  }}
                >
                  {automationDisplayPercentage}%
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "20px",
                    color: "#a3a3a3",
                    fontWeight: "bold",
                    marginTop: "8px",
                  }}
                >
                  BOT
                </div>
              </div>
            </div>
          </div>

          {/* Heatmap Area */}
          <div
            style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: `${CELL_GAP}px`,
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              {cells.map((column, colIndex) => (
                <div
                  key={colIndex}
                  style={{ display: "flex", flexDirection: "column", gap: `${CELL_GAP}px` }}
                >
                  {column.map((data, rowIndex) => {
                    const color = data
                      ? getSquareColor(data.human, data.ai, data.automation, maxActivity || 1)
                      : null;
                    return (
                      <div
                        key={rowIndex}
                        style={{
                          display: "flex",
                          width: `${CELL_SIZE}px`,
                          height: `${CELL_SIZE}px`,
                          borderRadius: "2px",
                          backgroundColor: color || "#262626",
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            marginTop: "24px",
            color: "#737373",
            fontSize: "20px",
            fontWeight: "bold",
          }}
        >
          <div style={{ display: "flex" }}>aivshuman.thedaviddias.com</div>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
        headers: {
          "cache-control": "public, max-age=60, s-maxage=60",
        },
      }
    );
  } catch (e) {
    logger.error("OG user image generation failed", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
