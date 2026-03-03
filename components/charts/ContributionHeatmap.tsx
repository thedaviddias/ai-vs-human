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
}

interface ContributionHeatmapProps {
  data: DailyDataPoint[];
  viewMode: "commits" | "loc";
  /** When true, a sync is in progress and data may be incomplete */
  isSyncing?: boolean;
  /** When true, merged data includes private repos (which lack LOC data) */
  includesPrivateData?: boolean;
  /** Optional overlay series keyed by UTC midnight epoch ms */
  sourceOverlayByDate?: Record<number, number>;
  /** Legend + tooltip label for overlay series */
  sourceOverlayLabel?: string;
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

// Flat discrete colors — no more lerp or rgba complexity
const COLORS_HUMAN = ["#064e3b", "#065f46", "#059669", "#10b981", "#34d399"]; // Emerald shades
const COLORS_AI = ["#4c1d95", "#5b21b6", "#7c3aed", "#8b5cf6", "#a78bfa"]; // Violet shades
const COLORS_AUTOMATION = ["#78350f", "#92400e", "#b45309", "#d97706", "#f59e0b"]; // Amber shades
const COLORS_SOURCE_OVERLAY = ["#164e63", "#0e7490", "#0891b2", "#06b6d4", "#22d3ee"]; // Cyan shades

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""] as const;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

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
  sourceOverlay: number;
  dateLabel: string;
  ariaLabel: string;
}

function getActivityLevel(total: number, maxActivity: number): number {
  if (maxActivity <= 0) return 0;
  return Math.min(4, Math.floor((total / maxActivity) * 5));
}

/**
 * Returns either a single solid color or a left-to-right mixed gradient.
 * Intensity still scales with total activity; composition reflects type shares.
 */
function getSquareFill(
  human: number,
  ai: number,
  automation: number,
  maxActivity: number,
  gradientId: string
): SquareFill {
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

/**
 * Calculate how many week columns fit in the available container width.
 * Returns a value clamped between MIN_WEEKS and MAX_WEEKS.
 */
function calcVisibleWeeks(containerWidth: number): number {
  if (containerWidth <= 0) return MAX_WEEKS;
  const available = containerWidth - LABEL_LEFT;
  const weeks = Math.floor(available / CELL_STEP);
  return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, weeks));
}

/**
 * Build a grid of N weeks ending on today.
 * Returns an array of { col, row, date, data? } entries.
 */
function buildGrid(dataMap: Map<number, DailyDataPoint>, weeksShown: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // End on today's day-of-week position (GitHub convention)
  const todayDow = (today.getUTCDay() + 6) % 7; // Mon=0, Sun=6

  // Total cells: weeksShown full weeks + partial current week
  const totalDays = weeksShown * 7 + todayDow + 1;
  const startDate = new Date(today.getTime() - (totalDays - 1) * 86_400_000);

  const cells: GridCell[] = [];

  for (let i = 0; i < totalDays; i++) {
    const cellDate = new Date(startDate.getTime() + i * 86_400_000);
    const dow = (cellDate.getUTCDay() + 6) % 7; // Mon=0
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

/**
 * Compute month label positions for the top axis.
 * Returns { label, col } pairs for the first Monday of each new month.
 */
function buildMonthLabels(
  cells: Array<{ col: number; row: number; date: Date }>
): Array<{ label: string; col: number }> {
  const labels: Array<{ label: string; col: number }> = [];
  let lastMonth = -1;

  for (const cell of cells) {
    if (cell.row !== 0) continue; // only look at Monday rows
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
  viewMode: "commits" | "loc",
  human: number,
  ai: number,
  automation: number,
  total: number,
  sourceOverlay: number,
  sourceOverlayLabel: string
): string {
  const unit = viewMode === "loc" ? "lines" : "commits";
  if (total === 0) {
    if (viewMode === "loc" && sourceOverlay > 0) {
      return `${dateLabel}. No activity. ${sourceOverlayLabel}: ${sourceOverlay.toLocaleString()}.`;
    }
    return `${dateLabel}. No activity.`;
  }
  const overlayPart =
    viewMode === "loc" ? ` ${sourceOverlayLabel}: ${sourceOverlay.toLocaleString()}.` : "";
  return `${dateLabel}: ${total.toLocaleString()} ${unit}. H ${human.toLocaleString()}, AI ${ai.toLocaleString()}, Bot ${automation.toLocaleString()}.${overlayPart}`;
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
  sourceOverlay: number;
}

export function ContributionHeatmap({
  data,
  viewMode,
  isSyncing,
  includesPrivateData,
  sourceOverlayByDate,
  sourceOverlayLabel = "Source overlay",
}: ContributionHeatmapProps) {
  const gradientPrefix = useId().replace(/:/g, "");
  const chartDescriptionId = `${gradientPrefix}-chart-description`;
  const tableCaptionId = `${gradientPrefix}-table-caption`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  // Measure container width with ResizeObserver for responsive layout
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial measurement
    setContainerWidth(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // How many weeks fit in the current container width
  const visibleWeeks = useMemo(() => calcVisibleWeeks(containerWidth), [containerWidth]);

  // Build lookup map: date (epoch ms) -> data point
  const dataMap = useMemo(() => {
    const map = new Map<number, DailyDataPoint>();
    for (const point of data) {
      map.set(point.date, point);
    }
    return map;
  }, [data]);

  const sourceOverlayMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!sourceOverlayByDate) return map;
    for (const [dateKey, value] of Object.entries(sourceOverlayByDate)) {
      const date = Number(dateKey);
      if (Number.isFinite(date) && typeof value === "number" && value > 0) {
        map.set(date, value);
      }
    }
    return map;
  }, [sourceOverlayByDate]);

  const cells = useMemo(() => buildGrid(dataMap, visibleWeeks), [dataMap, visibleWeeks]);
  const monthLabels = useMemo(() => buildMonthLabels(cells), [cells]);

  // Maximum activity for intensity scaling
  const maxActivity = useMemo(() => {
    let max = 0;
    for (const point of data) {
      const val =
        viewMode === "loc"
          ? point.humanAdditions + point.aiAdditions + (point.automationAdditions ?? 0)
          : point.human + point.ai + (point.automation ?? 0);
      if (val > max) max = val;
    }
    return max;
  }, [data, viewMode]);

  const maxSourceOverlay = useMemo(() => {
    if (viewMode !== "loc" || sourceOverlayMap.size === 0) return 0;
    let max = 0;
    for (const value of sourceOverlayMap.values()) {
      if (value > max) max = value;
    }
    return max;
  }, [sourceOverlayMap, viewMode]);

  // Detect if LOC view has suspiciously sparse data (possible enrichment gap)
  const locDataWarning = useMemo(() => {
    if (viewMode !== "loc" || data.length === 0) return false;
    const withLoc = data.filter(
      (d) => d.humanAdditions + d.aiAdditions + (d.automationAdditions ?? 0) > 0
    ).length;
    const withCommits = data.filter((d) => d.human + d.ai + (d.automation ?? 0) > 0).length;
    // If most days have commits but few have LOC, enrichment may be incomplete
    return withCommits > 0 && withLoc / withCommits < 0.5;
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
      const total = human + ai + automation;
      const sourceOverlay = viewMode === "loc" ? (sourceOverlayMap.get(cell.dateMs) ?? 0) : 0;
      const dateLabel = formatDate(cell.date);
      const ariaDateLabel = formatAriaDate(cell.date);
      const gradientId = `${gradientPrefix}-${cell.dateMs}`;
      const squareFill = getSquareFill(human, ai, automation, maxActivity, gradientId);

      return {
        cell,
        gradientId,
        fill: squareFill.fill,
        gradientStops: squareFill.gradientStops,
        human,
        ai,
        automation,
        total,
        sourceOverlay,
        dateLabel,
        ariaLabel: formatCellAriaLabel(
          ariaDateLabel,
          viewMode,
          human,
          ai,
          automation,
          total,
          sourceOverlay,
          sourceOverlayLabel
        ),
      };
    });
  }, [cells, viewMode, sourceOverlayMap, gradientPrefix, maxActivity, sourceOverlayLabel]);

  // Detect if data exists but none falls within the visible grid window
  const hasVisibleData = useMemo(() => {
    if (renderedCells.length === 0) return false;
    return renderedCells.some(
      (cell) => cell.total > 0 || (viewMode === "loc" && cell.sourceOverlay > 0)
    );
  }, [renderedCells, viewMode]);

  const accessibleRows = useMemo(() => {
    return renderedCells.filter(
      (cell) => cell.total > 0 || (viewMode === "loc" && cell.sourceOverlay > 0)
    );
  }, [renderedCells, viewMode]);

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
      sourceOverlay: renderedCell.sourceOverlay,
    });
  }, []);

  const clearTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const hasData = data.length > 0 || (viewMode === "loc" && sourceOverlayMap.size > 0);
  const showSourceOverlayLegend = viewMode === "loc" && sourceOverlayMap.size > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <p id={chartDescriptionId} className="sr-only">
        Contribution heatmap for the last twelve months, grouped by day in UTC. Squares may contain
        mixed colors to represent human, AI, and automation shares. Focus a square for day details,
        or use the data table below for a full accessible list of active days.
      </p>
      <div>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="block w-full"
          style={{ aspectRatio: `${svgWidth} / ${svgHeight}` }}
          role="img"
          aria-label="Contribution heatmap showing human vs AI vs automation activity"
          aria-describedby={chartDescriptionId}
        >
          <defs>
            {renderedCells.map(({ gradientId, gradientStops }) =>
              gradientStops ? (
                <linearGradient key={gradientId} id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  {gradientStops.map((stop) => (
                    <stop
                      key={`${gradientId}-${stop.offset.toFixed(4)}-${stop.color}`}
                      offset={`${stop.offset}%`}
                      stopColor={stop.color}
                    />
                  ))}
                </linearGradient>
              ) : null
            )}
          </defs>

          {/* Month labels along top */}
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

          {/* Day-of-week labels on left */}
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

          {/* Cells */}
          {renderedCells.map((renderedCell) => {
            const { cell, fill, total, ariaLabel, sourceOverlay } = renderedCell;
            const sourceOverlayLevel = getActivityLevel(sourceOverlay, maxSourceOverlay);
            return (
              <g key={cell.dateMs}>
                {/* biome-ignore lint/a11y/noStaticElementInteractions: SVG rect supports hover + keyboard focus to expose the same tooltip content */}
                <rect
                  x={LABEL_LEFT + cell.col * CELL_STEP}
                  y={LABEL_TOP + cell.row * CELL_STEP}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  ry={2}
                  fill={fill ?? undefined}
                  className={`cursor-pointer transition-opacity hover:opacity-80 ${fill === null ? "fill-neutral-800" : ""}`}
                  tabIndex={total > 0 || (viewMode === "loc" && sourceOverlay > 0) ? 0 : -1}
                  aria-label={ariaLabel}
                  onMouseEnter={(e) => showTooltipForCell(e.currentTarget, renderedCell)}
                  onMouseLeave={clearTooltip}
                  onFocus={(e) => showTooltipForCell(e.currentTarget, renderedCell)}
                  onBlur={clearTooltip}
                />
                {viewMode === "loc" && sourceOverlay > 0 && (
                  <circle
                    cx={LABEL_LEFT + cell.col * CELL_STEP + CELL_SIZE / 2}
                    cy={LABEL_TOP + cell.row * CELL_STEP + CELL_SIZE / 2}
                    r={Math.max(1.5, 1.5 + sourceOverlayLevel * 0.7)}
                    fill={COLORS_SOURCE_OVERLAY[sourceOverlayLevel]}
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Empty state overlay */}
      {!hasData && !isSyncing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-neutral-500 backdrop-blur-sm border border-neutral-800">
            No commit data yet. Re-sync to populate daily activity.
          </p>
        </div>
      )}

      {/* Data exists but is all outside the visible window */}
      {hasData && !hasVisibleData && !isSyncing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-neutral-500 backdrop-blur-sm border border-neutral-800">
            All activity is older than 1 year. Heatmap shows the last 12 months.
          </p>
        </div>
      )}

      {/* LOC data warning */}
      {locDataWarning && (
        <p className="mt-1 text-[11px] text-amber-500">
          {includesPrivateData
            ? "Code volume isn\u2019t available for private repos. This view reflects public repo activity only."
            : isSyncing
              ? "Code volume data may be incomplete for some commits. Enrichment in progress..."
              : "Code volume data may be incomplete for some commits. Try re-syncing."}
        </p>
      )}

      {/* Legend — simplified discrete boxes */}
      <div className="mt-4 flex flex-col gap-3 text-[11px] text-neutral-500 border-t border-neutral-800 pt-4">
        <div>
          <span>
            {viewMode === "loc" ? "Code added per day" : "Commits per day"} — UTC. Mixed days are
            split by share.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span>Less</span>
            <div className="flex gap-1">
              {COLORS_HUMAN.map((c) => (
                <div key={c} className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span>More (Human)</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-4">
            <div className="flex gap-1">
              {COLORS_AI.map((c) => (
                <div key={c} className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span>(AI)</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-4">
            <div className="flex gap-1">
              {COLORS_AUTOMATION.map((c) => (
                <div key={c} className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span>(Automation)</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-4">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                background: `linear-gradient(90deg, ${COLORS_HUMAN[2]} 0% 33%, ${COLORS_AI[2]} 33% 66%, ${COLORS_AUTOMATION[2]} 66% 100%)`,
              }}
            />
            <span>(Mixed)</span>
          </div>
          {showSourceOverlayLegend && (
            <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-4">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
              <span>{sourceOverlayLabel} (Overlay)</span>
            </div>
          )}
        </div>
      </div>

      <table className="sr-only" aria-describedby={chartDescriptionId}>
        <caption id={tableCaptionId}>
          Daily {viewMode === "loc" ? "lines added" : "commits"} for active days in the last twelve
          months (UTC)
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Human</th>
            <th scope="col">AI</th>
            <th scope="col">Automation</th>
            {viewMode === "loc" && <th scope="col">{sourceOverlayLabel}</th>}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {accessibleRows.map(
            ({ cell, dateLabel, human, ai, automation, total, sourceOverlay }) => (
              <tr key={`table-${cell.dateMs}`}>
                <th scope="row">{dateLabel}</th>
                <td>{human.toLocaleString()}</td>
                <td>{ai.toLocaleString()}</td>
                <td>{automation.toLocaleString()}</td>
                {viewMode === "loc" && <td>{sourceOverlay.toLocaleString()}</td>}
                <td>{total.toLocaleString()}</td>
              </tr>
            )
          )}
        </tbody>
      </table>

      {/* Tooltip — Card UI */}
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
              {tooltip.total.toLocaleString()} {viewMode === "loc" ? "lines added" : "commits"}{" "}
              total
              {tooltip.total > 0 && ` (${tooltip.aiPercentage}% AI)`}
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-4 py-3.5 text-sm">
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
            {viewMode === "loc" && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                  <div className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                  {sourceOverlayLabel}
                </span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {tooltip.sourceOverlay.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
