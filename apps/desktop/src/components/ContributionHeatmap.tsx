"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export interface DailyDataPoint {
  date: number; // epoch ms, midnight UTC
  human: number;
  ai: number;
  automation?: number;
  humanAdditions: number;
  aiAdditions: number;
  automationAdditions?: number;
  // Local Cursor metrics
  linesEdited?: number;
  aiLineEdits?: number;
  tabAcceptedLines?: number;
  composerAcceptedLines?: number;
}

interface ContributionHeatmapProps {
  data: DailyDataPoint[];
  viewMode: "commits" | "loc" | "linesEdited";
  lineEditMode?: "cursor" | "combined" | "tab";
  /** When true, a sync is in progress and data may be incomplete */
  isSyncing?: boolean;
}

// Layout constants
const CELL_SIZE = 11;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const ROWS = 7;
const LABEL_LEFT = 30;
const LABEL_TOP = 18;
const MAX_WEEKS = 53;
const MIN_WEEKS = 10;

// Flat discrete colors — identical to aivshuman.dev
const COLORS_HUMAN = ["#064e3b", "#065f46", "#059669", "#10b981", "#34d399"]; // Emerald shades
const COLORS_AI = ["#4c1d95", "#5b21b6", "#7c3aed", "#8b5cf6", "#a78bfa"]; // Violet shades
const COLORS_AUTOMATION = ["#78350f", "#92400e", "#b45309", "#d97706", "#f59e0b"]; // Amber shades
// Muted cyan ramp to better match Cursor's heatmap contrast.
const COLORS_ACCEPTED = ["#0b3a4a", "#0f5464", "#146d81", "#1d8195"];

const DAY_LABELS = ["S", "", "T", "", "T", "", "S"] as const;

const MONTH_NAMES = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;

interface GradientStop {
  offset: number;
  color: string;
}

interface SquareFill {
  fill: string | null;
  gradientStops?: GradientStop[];
}

interface GridCell {
  col: number;
  row: number;
  date: Date;
  dateMs: number;
  data: DailyDataPoint | undefined;
}

interface RenderedCell {
  cell: GridCell;
  gradientId: string;
  fill: string | null;
  gradientStops?: GradientStop[];
  human: number;
  ai: number;
  automation: number;
  total: number;
  dateLabel: string;
  ariaLabel: string;
  linesEdited: number;
  tabAcceptedLines: number;
  composerAcceptedLines: number;
}

function getActivityLevel(total: number, maxActivity: number, levels = 5): number {
  if (maxActivity <= 0) return 0;
  return Math.min(levels - 1, Math.floor((total / maxActivity) * levels));
}

/**
 * Returns either a single solid color or a left-to-right mixed gradient.
 * Intensity still scales with total activity; composition reflects type shares.
 */
function getSquareFill(
  human: number,
  ai: number,
  automation: number,
  linesEdited: number,
  maxActivity: number,
  gradientId: string,
  viewMode: "commits" | "loc" | "linesEdited"
): SquareFill {
  if (viewMode === "linesEdited") {
    if (linesEdited === 0) return { fill: null };
    const intensity = getActivityLevel(linesEdited, maxActivity, COLORS_ACCEPTED.length);
    return { fill: COLORS_ACCEPTED[intensity] };
  }

  const total = human + ai + automation;
  if (total === 0) return { fill: null };

  const intensity = getActivityLevel(total, maxActivity);
  const segments = [
    { value: human, color: COLORS_HUMAN[intensity] },
    { value: ai, color: COLORS_AI[intensity] },
    { value: automation, color: COLORS_AUTOMATION[intensity] },
  ].filter((segment) => segment.value > 0);

  if (segments.length === 1) {
    return { fill: segments[0]?.color ?? COLORS_HUMAN[intensity] };
  }

  const gradientStops: GradientStop[] = [];
  let consumed = 0;
  for (const segment of segments) {
    const start = (consumed / total) * 100;
    consumed += segment.value;
    const end = (consumed / total) * 100;
    gradientStops.push({ offset: start, color: segment.color });
    gradientStops.push({ offset: end, color: segment.color });
  }

  return {
    fill: `url(#${gradientId})`,
    gradientStops,
  };
}

function calcVisibleWeeks(containerWidth: number): number {
  if (containerWidth <= 0) return MAX_WEEKS;
  const available = containerWidth - LABEL_LEFT;
  const weeks = Math.floor(available / CELL_STEP);
  return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, weeks));
}

function buildGrid(dataMap: Map<number, DailyDataPoint>, weeksShown: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // End on today's day-of-week position (0=Sun, 6=Sat)
  const todayDow = today.getUTCDay();
  const totalDays = weeksShown * 7 + todayDow + 1;
  const startDate = new Date(today.getTime() - (totalDays - 1) * 86_400_000);

  const cells: GridCell[] = [];

  for (let i = 0; i < totalDays; i++) {
    const cellDate = new Date(startDate.getTime() + i * 86_400_000);
    const dow = cellDate.getUTCDay(); // 0=Sun
    const col = Math.floor(i / 7);
    const dateMs = cellDate.getTime();

    cells.push({
      col,
      row: dow,
      date: cellDate,
      dateMs,
      data: dataMap.get(dateMs),
    });
  }

  return cells;
}

function buildMonthLabels(
  cells: Array<{ col: number; row: number; date: Date }>
): Array<{ label: string; col: number }> {
  const labels: Array<{ label: string; col: number }> = [];
  let lastMonth = -1;

  for (const cell of cells) {
    if (cell.row !== 0) continue; // only look at Sunday rows
    const month = cell.date.getUTCMonth();
    if (month !== lastMonth) {
      labels.push({ label: MONTH_NAMES[month], col: cell.col });
      lastMonth = month;
    }
  }

  return labels;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatAriaDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCellAriaLabel(
  dateLabel: string,
  viewMode: "commits" | "loc" | "linesEdited",
  human: number,
  ai: number,
  automation: number,
  total: number,
  linesEdited: number
): string {
  if (viewMode === "linesEdited") {
    if (linesEdited === 0) return `${dateLabel}. No lines edited.`;
    return `${dateLabel}: ${linesEdited.toLocaleString()} lines edited.`;
  }
  const unit = viewMode === "loc" ? "lines" : "commits";
  if (total === 0) return `${dateLabel}. No activity.`;
  return `${dateLabel}: ${total.toLocaleString()} ${unit}. H ${human.toLocaleString()}, AI ${ai.toLocaleString()}, Bot ${automation.toLocaleString()}.`;
}

interface TooltipInfo {
  x: number;
  y: number;
  dateLabel: string;
  human: number;
  ai: number;
  automation: number;
  total: number;
  aiPercentage: string;
  linesEdited: number;
  tabAcceptedLines: number;
  composerAcceptedLines: number;
}

export function ContributionHeatmap({
  data,
  viewMode,
  lineEditMode = "cursor",
  isSyncing,
}: ContributionHeatmapProps) {
  const gradientPrefix = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visibleWeeks = useMemo(() => calcVisibleWeeks(containerWidth), [containerWidth]);
  const dataMap = useMemo(() => {
    const map = new Map<number, DailyDataPoint>();
    for (const point of data) map.set(point.date, point);
    return map;
  }, [data]);

  const cells = useMemo(() => buildGrid(dataMap, visibleWeeks), [dataMap, visibleWeeks]);
  const monthLabels = useMemo(() => buildMonthLabels(cells), [cells]);

  const maxActivity = useMemo(() => {
    let max = 0;
    for (const point of data) {
      let val = 0;
      if (viewMode === "loc") {
        val = point.humanAdditions + point.aiAdditions + (point.automationAdditions ?? 0);
      } else if (viewMode === "linesEdited") {
        val = point.linesEdited ?? 0;
      } else {
        val = point.human + point.ai + (point.automation ?? 0);
      }
      if (val > max) max = val;
    }
    return max;
  }, [data, viewMode]);

  const totalCols = cells.length > 0 ? cells[cells.length - 1].col + 1 : visibleWeeks;
  const svgWidth = LABEL_LEFT + totalCols * CELL_STEP;
  const svgHeight = LABEL_TOP + ROWS * CELL_STEP;

  const renderedCells = useMemo(() => {
    return cells.map((cell): RenderedCell => {
      const human = viewMode === "loc" ? (cell.data?.humanAdditions ?? 0) : (cell.data?.human ?? 0);
      const ai = viewMode === "loc" ? (cell.data?.aiAdditions ?? 0) : (cell.data?.ai ?? 0);
      const automation =
        viewMode === "loc" ? (cell.data?.automationAdditions ?? 0) : (cell.data?.automation ?? 0);
      const linesEdited = cell.data?.linesEdited ?? 0;
      const tabAcceptedLines = cell.data?.tabAcceptedLines ?? 0;
      const composerAcceptedLines = cell.data?.composerAcceptedLines ?? 0;
      const total = human + ai + automation;
      const dateLabel = formatDate(cell.date);
      const ariaDateLabel = formatAriaDate(cell.date);
      const gradientId = `${gradientPrefix}-${cell.dateMs}`;
      const squareFill = getSquareFill(
        human,
        ai,
        automation,
        linesEdited,
        maxActivity,
        gradientId,
        viewMode
      );

      return {
        cell,
        gradientId,
        fill: squareFill.fill,
        gradientStops: squareFill.gradientStops,
        human,
        ai,
        automation,
        total,
        linesEdited,
        tabAcceptedLines,
        composerAcceptedLines,
        dateLabel,
        ariaLabel: formatCellAriaLabel(
          ariaDateLabel,
          viewMode,
          human,
          ai,
          automation,
          total,
          linesEdited
        ),
      };
    });
  }, [cells, viewMode, gradientPrefix, maxActivity]);

  const showTooltipForCell = useCallback((target: SVGRectElement, renderedCell: RenderedCell) => {
    const rect = target.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      dateLabel: renderedCell.dateLabel,
      human: renderedCell.human,
      ai: renderedCell.ai,
      automation: renderedCell.automation,
      total: renderedCell.total,
      aiPercentage:
        renderedCell.total > 0 ? ((renderedCell.ai / renderedCell.total) * 100).toFixed(0) : "0",
      linesEdited: renderedCell.linesEdited,
      tabAcceptedLines: renderedCell.tabAcceptedLines,
      composerAcceptedLines: renderedCell.composerAcceptedLines,
    });
  }, []);

  const clearTooltip = useCallback(() => setTooltip(null), []);

  const hasData = data.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="block w-full"
          style={{ aspectRatio: `${svgWidth} / ${svgHeight}` }}
          role="img"
          aria-label="Contribution heatmap"
        >
          <defs>
            {renderedCells.map(({ gradientId, gradientStops }) =>
              gradientStops ? (
                <linearGradient key={gradientId} id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  {gradientStops.map((stop) => (
                    <stop key={stop.offset} offset={`${stop.offset}%`} stopColor={stop.color} />
                  ))}
                </linearGradient>
              ) : null
            )}
          </defs>

          {monthLabels.map(({ label, col }) => (
            <text
              key={`${label}-${col}`}
              x={LABEL_LEFT + col * CELL_STEP}
              y={LABEL_TOP - 5}
              className="fill-neutral-500 text-[10px]"
            >
              {label}
            </text>
          ))}

          {DAY_LABELS.map((label, i) =>
            label ? (
              <text
                key={label}
                x={LABEL_LEFT - 6}
                y={LABEL_TOP + i * CELL_STEP + CELL_SIZE / 2 + 3}
                textAnchor="end"
                className="fill-neutral-400 text-[10px]"
              >
                {label}
              </text>
            ) : null
          )}

          {renderedCells.map((renderedCell) => {
            const { cell, fill, total, ariaLabel, linesEdited } = renderedCell;
            const isClickable = viewMode === "linesEdited" ? linesEdited > 0 : total > 0;
            return (
              // biome-ignore lint/a11y/useSemanticElements: SVG rect needs role="button" for interactivity
              <rect
                key={cell.dateMs}
                x={LABEL_LEFT + cell.col * CELL_STEP}
                y={LABEL_TOP + cell.row * CELL_STEP}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                ry={2}
                fill={fill ?? undefined}
                className={`cursor-pointer transition-opacity hover:opacity-80 ${fill === null ? "fill-neutral-800" : ""}`}
                role="button"
                aria-roledescription="contribution cell"
                tabIndex={isClickable ? 0 : -1}
                aria-label={ariaLabel}
                onMouseEnter={(e) => showTooltipForCell(e.currentTarget, renderedCell)}
                onMouseLeave={clearTooltip}
                onFocus={(e) => showTooltipForCell(e.currentTarget, renderedCell)}
                onBlur={clearTooltip}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    showTooltipForCell(e.currentTarget, renderedCell);
                  }
                }}
              />
            );
          })}
        </svg>

        {!hasData && !isSyncing && (
          <div className="flex items-center justify-center p-8 text-sm text-neutral-500">
            No activity data yet.
          </div>
        )}

        {/* Legend — identical to website */}
        <div className="mt-4 flex flex-col gap-3 text-[11px] text-neutral-500 border-t border-neutral-800 pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {viewMode === "linesEdited" ? (
              <div className="flex items-center gap-1.5">
                <span>Less</span>
                <div className="flex gap-1">
                  {COLORS_ACCEPTED.map((c) => (
                    <div
                      key={c}
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <span>More (Lines Edited)</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span>Less</span>
                  <div className="flex gap-1">
                    {COLORS_HUMAN.map((c) => (
                      <div
                        key={c}
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span>More (Human)</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-4">
                  <div className="flex gap-1">
                    {COLORS_AI.map((c) => (
                      <div
                        key={c}
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span>(AI)</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-4">
                  <div className="flex gap-1">
                    {COLORS_AUTOMATION.map((c) => (
                      <div
                        key={c}
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span>(Bot)</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full min-w-[220px] overflow-hidden rounded-xl border border-neutral-200/80 bg-white/95 shadow-2xl backdrop-blur-md dark:border-neutral-700/80 dark:bg-neutral-800/95"
          style={{ left: tooltip.x, top: tooltip.y - 12 }}
        >
          <div className="border-b border-neutral-200/80 bg-neutral-50/50 px-4 py-3 dark:border-neutral-700/80 dark:bg-neutral-900/50">
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {tooltip.dateLabel}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {viewMode === "linesEdited"
                ? lineEditMode === "combined"
                  ? `${tooltip.linesEdited.toLocaleString()} lines edited (Cursor ${tooltip.composerAcceptedLines.toLocaleString()}, Tab ${tooltip.tabAcceptedLines.toLocaleString()})`
                  : lineEditMode === "cursor"
                    ? `${tooltip.linesEdited.toLocaleString()} cursor heatmap lines edited`
                    : `${tooltip.linesEdited.toLocaleString()} tab accepted lines`
                : `${tooltip.total.toLocaleString()} ${viewMode === "loc" ? "lines" : "commits"} total (${tooltip.aiPercentage}% AI)`}
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-4 py-3.5 text-sm">
            {viewMode === "linesEdited" ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                    <div
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: "#22d3ee" }}
                    />
                    {lineEditMode === "combined"
                      ? "Cursor + Tab"
                      : lineEditMode === "cursor"
                        ? "Cursor (Heatmap)"
                        : "Tab Accepted"}
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {tooltip.linesEdited.toLocaleString()}
                  </span>
                </div>
                {lineEditMode === "combined" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                        <div className="h-2.5 w-2.5 rounded-sm bg-teal-400" />
                        Cursor (Heatmap)
                      </span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {tooltip.composerAcceptedLines.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                        <div className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
                        Tab Accepted
                      </span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {tooltip.tabAcceptedLines.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                    <div className="h-2.5 w-2.5 rounded-sm bg-green-500" />
                    Human
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {tooltip.human.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                    <div className="h-2.5 w-2.5 rounded-sm bg-purple-500" />
                    AI
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {tooltip.ai.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                    <div className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                    Automation
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {tooltip.automation.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
