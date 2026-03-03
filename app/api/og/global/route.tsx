import { fetchQuery } from "convex/nextjs";
import { ImageResponse } from "next/og";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";
import {
  buildOgHeatmapGrid,
  getBlendColor,
  getSplitSegments,
  parseOgSquareMode,
  pickOgSquareMode,
} from "@/lib/og/squareRendering";

export const runtime = "edge";

// Heatmap constants — same as user/repo OG images
const CELL_SIZE = 16;
const CELL_GAP = 3;
const WEEKS_TO_SHOW = 52;

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedSquareMode = parseOgSquareMode(searchParams.get("squareMode"));
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

    const { cells, maxActivity, complexity } = buildOgHeatmapGrid({
      dailyData: dailyStats,
      weeksToShow: WEEKS_TO_SHOW,
    });
    const selectedSquareMode = pickOgSquareMode(requestedSquareMode, complexity);
    logger.info("OG global square mode selected", {
      requestedMode: requestedSquareMode,
      selectedMode: selectedSquareMode,
      complexity,
    });

    const imageHeaders = {
      "cache-control": "public, max-age=3600, s-maxage=3600",
    };
    const renderImage = (squareMode: "split" | "blend") =>
      new ImageResponse(
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
            <div
              style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "24px" }}
            >
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
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                justifyContent: "center",
              }}
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
                      const segments =
                        squareMode === "split"
                          ? getSplitSegments(data.human, data.ai, data.automation, maxActivity || 1)
                          : null;
                      const color =
                        squareMode === "blend"
                          ? getBlendColor(data.human, data.ai, data.automation, maxActivity || 1)
                          : null;
                      return (
                        <div
                          key={rowIndex}
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            width: `${CELL_SIZE}px`,
                            height: `${CELL_SIZE}px`,
                            borderRadius: "2px",
                            overflow: "hidden",
                            backgroundColor: color || "#262626",
                          }}
                        >
                          {segments?.map((segment, segmentIndex) => (
                            <div
                              key={`cell-${colIndex}-${rowIndex}-${segmentIndex}`}
                              style={{
                                display: "flex",
                                width: `${segment.widthPct}%`,
                                height: "100%",
                                backgroundColor: segment.color,
                              }}
                            />
                          ))}
                        </div>
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
            <div style={{ display: "flex" }}>aivshuman.dev</div>
          </div>
        </div>,
        {
          width: 1200,
          height: 630,
          headers: imageHeaders,
        }
      );
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
        logger.warn("OG global split rendering failed, retrying with blend", {
          requestedMode: requestedSquareMode,
          complexity,
          error: String(renderError),
        });
        return await renderBufferedImage("blend");
      }
      throw renderError;
    }
  } catch (e) {
    logger.error("OG global image generation failed", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
