import { fetchQuery } from "convex/nextjs";
import { ImageResponse } from "next/og";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";

export const runtime = "edge";

// Heatmap constants — same as user/repo OG images
const CELL_SIZE = 16;
const CELL_GAP = 3;
const WEEKS_TO_SHOW = 52;

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

function formatBigNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatPct(val: string | null | undefined) {
  if (!val) return "0";
  const num = Number.parseFloat(val);
  if (num === 0) return "0";
  if (num < 0.1) {
    const formatted = num.toFixed(2);
    return formatted.endsWith("0") ? num.toFixed(1) : formatted;
  }
  return num.toFixed(1);
}

export async function GET() {
  try {
    const [summary, dailyStats] = await Promise.all([
      fetchQuery(api.queries.globalStats.getGlobalSummary, {}),
      fetchQuery(api.queries.globalStats.getGlobalDailyStats, {}),
    ]);

    // If no data yet, show a static fallback
    if (!summary || summary.totals.total === 0) {
      return new ImageResponse(
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0a",
            color: "#fff",
            padding: "80px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "80px",
              fontWeight: "bold",
              letterSpacing: "-0.04em",
            }}
          >
            AI vs Human
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "28px",
              color: "#737373",
              fontWeight: 500,
              marginTop: "12px",
            }}
          >
            Who's writing open source?
          </div>
        </div>,
        {
          width: 1200,
          height: 630,
          headers: { "cache-control": "public, max-age=60, s-maxage=60" },
        }
      );
    }

    const humanDisplayPercentage = formatPct(summary.humanPercentage);
    const aiDisplayPercentage = formatPct(summary.aiPercentage);
    const automationDisplayPercentage = formatPct(summary.automationPercentage);

    // Build heatmap grid from daily stats
    const dataMap = new Map<number, { human: number; ai: number; automation: number }>();
    let maxActivity = 0;
    for (const p of dailyStats) {
      dataMap.set(p.date, { human: p.human, ai: p.ai, automation: p.automation ?? 0 });
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
            {/* Split green/violet logo */}
            <div
              style={{
                display: "flex",
                width: "80px",
                height: "80px",
                borderRadius: "20px",
                border: "2px solid rgba(255,255,255,0.1)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "50%",
                  height: "100%",
                  backgroundColor: "#4ade80",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: "50%",
                  height: "100%",
                  backgroundColor: "#a78bfa",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: "42px",
                  fontWeight: "bold",
                  letterSpacing: "-0.02em",
                }}
              >
                AI vs Human
              </div>
              <div
                style={{ display: "flex", fontSize: "24px", color: "#a3a3a3", marginTop: "2px" }}
              >
                Who's writing open source?
              </div>
            </div>
          </div>

          {/* Repo count badge */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "12px",
              backgroundColor: "#171717",
              padding: "16px 32px",
              borderRadius: "100px",
              border: "1px solid #404040",
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
              {summary.repoCount}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "24px",
                fontWeight: "bold",
                color: "#a3a3a3",
              }}
            >
              Repos Indexed
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
          "cache-control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  } catch (e) {
    logger.error("OG global image generation failed", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
