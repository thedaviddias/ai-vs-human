import { fetchQuery } from "convex/nextjs";
import { ImageResponse } from "next/og";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";

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
    const name = searchParams.get("name");

    if (!owner || !name) {
      return new Response("Missing parameters", { status: 400 });
    }

    const fullName = `${owner}/${name}`;

    // Parallel fetch: Repo summary + Daily stats for heatmap
    const [summary, dailyData] = await Promise.all([
      fetchQuery(api.queries.stats.getRepoSummary, { repoFullName: fullName }),
      fetchQuery(api.queries.stats.getDailyStats, { repoFullName: fullName }),
    ]);

    if (!summary || !dailyData) {
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
          Analyzing {fullName}...
        </div>,
        { width: 1200, height: 630 }
      );
    }

    // Always use commit-based percentages on OG images
    const humanDisplayPercentage = summary.humanPercentage;
    const aiDisplayPercentage = summary.aiPercentage;
    const automationDisplayPercentage = summary.automationPercentage;

    // Process heatmap data
    const dataMap = new Map();
    let maxActivity = 0;
    for (const p of dailyData) {
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
          backgroundColor: "#050505",
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
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "12px" }}
            >
              <div style={{ display: "flex", fontSize: "32px", color: "#737373", fontWeight: 500 }}>
                {owner} /
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "42px",
                  fontWeight: "bold",
                  color: "#4ade80",
                  letterSpacing: "-0.02em",
                }}
              >
                {name}
              </div>
            </div>
            {summary.repo.stars != null && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "8px",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="#fbbf24"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: "flex" }}
                  role="img"
                  aria-label="Star icon"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <div
                  style={{
                    display: "flex",
                    fontSize: "24px",
                    color: "#a3a3a3",
                    fontWeight: "bold",
                  }}
                >
                  {summary.repo.stars.toLocaleString()} stars
                </div>
              </div>
            )}
          </div>

          {/* Badge */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "16px",
              backgroundColor: "#111",
              padding: "16px 32px",
              borderRadius: "100px",
              border: "1px solid #333",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "28px",
                fontWeight: "bold",
                color: "#4ade80",
                letterSpacing: "-0.02em",
              }}
            >
              Repo Analysis
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0a0a0a",
            borderRadius: "24px",
            border: "1px solid #1a1a1a",
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
                {formatBigNumber(summary.totals.total)}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#525252",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginTop: "8px",
                }}
              >
                Commits
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
                    color: "#525252",
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
                    color: "#525252",
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
                    color: "#525252",
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
                          backgroundColor: color || "#121212",
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
            color: "#404040",
            fontSize: "20px",
            fontWeight: "bold",
          }}
        >
          <div style={{ display: "flex" }}>aivshuman.dev</div>
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
    logger.error("OG repo image generation failed", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
