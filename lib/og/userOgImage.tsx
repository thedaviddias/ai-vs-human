/**
 * Shared rendering logic for user OG images.
 *
 * Used by both the public (/api/og/user) and private (/api/og/user/private) routes.
 */

import type { ReactElement } from "react";
import { buildOgHeatmapGrid, getBlendColor, getSplitSegments } from "@/lib/og/squareRendering";
import { getRank } from "@/lib/ranks";

// Heatmap constants
const CELL_SIZE = 16;
const CELL_GAP = 3;
export const USER_OG_WEEKS_TO_SHOW = 52;

function formatPct(val: string | null | undefined): string {
  if (!val) return "0";
  const num = Number.parseFloat(val);
  if (num === 0) return "0";
  if (num < 0.1) {
    const formatted = num.toFixed(2);
    return formatted.endsWith("0") ? num.toFixed(1) : formatted;
  }
  return num.toFixed(1);
}

function formatBigNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export interface UserOgData {
  owner: string;
  avatarUrl: string;
  totalCommits: number;
  humanPercentage: string;
  aiPercentage: string;
  automationPercentage: string;
  locHumanPercentage?: string | null;
  dailyData: Array<{
    date: number;
    human: number;
    ai: number;
    automation: number;
  }>;
}

export interface RenderUserOgImageParams {
  user: UserOgData;
  displayName: string;
  squareMode?: "split" | "blend";
}

export function renderUserOgImage({
  user,
  displayName,
  squareMode = "split",
}: RenderUserOgImageParams): ReactElement {
  const humanDisplayPercentage = formatPct(user.humanPercentage);
  const aiDisplayPercentage = formatPct(user.aiPercentage);
  const automationDisplayPercentage = formatPct(user.automationPercentage);

  const humanPct = Number.parseFloat(user.locHumanPercentage ?? user.humanPercentage);
  const rank = getRank(humanPct);

  const { cells, maxActivity } = buildOgHeatmapGrid({
    dailyData: user.dailyData,
    weeksToShow: USER_OG_WEEKS_TO_SHOW,
  });

  return (
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
            <div style={{ display: "flex", fontSize: "32px", color: "#a3a3a3", marginTop: "2px" }}>
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
                key={`col-${colIndex}`}
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
                      key={`cell-${colIndex}-${rowIndex}`}
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
                            height: "100%",
                            width: `${segment.widthPct}%`,
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
    </div>
  );
}
