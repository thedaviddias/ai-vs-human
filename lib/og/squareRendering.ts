export type OgSquareMode = "auto" | "split" | "blend";

export interface OgSquareColors {
  human: readonly string[];
  ai: readonly string[];
  automation: readonly string[];
}

export interface OgSplitSegment {
  color: string;
  widthPct: number;
}

export interface OgComplexity {
  activeCellCount: number;
  segmentScore: number;
}

export interface OgDailyPoint {
  date: number;
  human: number;
  ai: number;
  automation?: number;
}

export interface OgNormalizedCounts {
  human: number;
  ai: number;
  automation: number;
  total: number;
}

export interface OgHeatmapGridResult {
  cells: OgNormalizedCounts[][];
  maxActivity: number;
  complexity: OgComplexity;
}

export interface BuildOgHeatmapGridParams {
  dailyData: OgDailyPoint[];
  weeksToShow: number;
  today?: Date;
}

export const OG_SQUARE_COLORS: OgSquareColors = {
  human: ["#064e3b", "#065f46", "#059669", "#10b981", "#34d399"],
  ai: ["#4c1d95", "#5b21b6", "#7c3aed", "#8b5cf6", "#a78bfa"],
  automation: ["#78350f", "#92400e", "#b45309", "#d97706", "#f59e0b"],
};

function toSafeNonNegative(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

export function parseOgSquareMode(value: string | null | undefined): OgSquareMode {
  if (value === "split" || value === "blend" || value === "auto") return value;
  return "auto";
}

export function normalizeCounts(
  human: number | null | undefined,
  ai: number | null | undefined,
  automation?: number | null
): OgNormalizedCounts {
  const safeHuman = toSafeNonNegative(human);
  const safeAi = toSafeNonNegative(ai);
  const safeAutomation = toSafeNonNegative(automation);
  return {
    human: safeHuman,
    ai: safeAi,
    automation: safeAutomation,
    total: safeHuman + safeAi + safeAutomation,
  };
}

export function getActivityLevel(total: number, maxActivity: number): number {
  if (maxActivity <= 0) return 0;
  return Math.min(4, Math.floor((total / maxActivity) * 5));
}

export function getSplitSegments(
  human: number,
  ai: number,
  automation: number,
  maxActivity: number,
  colors: OgSquareColors = OG_SQUARE_COLORS
): OgSplitSegment[] | null {
  const counts = normalizeCounts(human, ai, automation);
  if (counts.total === 0) return null;

  const intensity = getActivityLevel(counts.total, maxActivity);
  const segments = [
    { value: counts.human, color: colors.human[intensity] },
    { value: counts.ai, color: colors.ai[intensity] },
    { value: counts.automation, color: colors.automation[intensity] },
  ].filter((segment) => segment.value > 0);

  if (segments.length === 0) return null;
  if (segments.length === 1)
    return [{ color: segments[0]?.color ?? colors.human[intensity], widthPct: 100 }];

  const results: OgSplitSegment[] = [];
  let remaining = 100;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    const isLast = i === segments.length - 1;
    const widthPct = isLast
      ? Number(Math.max(0, remaining).toFixed(3))
      : Number(((segment.value / counts.total) * 100).toFixed(3));
    remaining -= widthPct;
    results.push({ color: segment.color, widthPct });
  }
  return results;
}

export function getBlendColor(
  human: number,
  ai: number,
  automation: number,
  maxActivity: number,
  colors: OgSquareColors = OG_SQUARE_COLORS
): string | null {
  const counts = normalizeCounts(human, ai, automation);
  if (counts.total === 0) return null;

  const intensity = getActivityLevel(counts.total, maxActivity);
  const segments = [
    { value: counts.human, color: colors.human[intensity] },
    { value: counts.ai, color: colors.ai[intensity] },
    { value: counts.automation, color: colors.automation[intensity] },
  ].filter((segment) => segment.value > 0);

  if (segments.length === 0) return null;
  if (segments.length === 1) return segments[0]?.color ?? colors.human[intensity];

  let r = 0;
  let g = 0;
  let b = 0;
  for (const segment of segments) {
    const weight = segment.value / counts.total;
    const [sr, sg, sb] = hexToRgb(segment.color);
    r += sr * weight;
    g += sg * weight;
    b += sb * weight;
  }

  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export function estimateOgComplexity(cells: Array<Array<OgNormalizedCounts | null>>): OgComplexity {
  let activeCellCount = 0;
  let segmentScore = 0;

  for (const column of cells) {
    for (const cell of column) {
      if (!cell || cell.total === 0) continue;
      activeCellCount += 1;
      segmentScore += Number(cell.human > 0) + Number(cell.ai > 0) + Number(cell.automation > 0);
    }
  }

  return { activeCellCount, segmentScore };
}

export function pickOgSquareMode(
  requestedMode: OgSquareMode,
  complexity: OgComplexity
): "split" | "blend" {
  if (requestedMode === "split" || requestedMode === "blend") return requestedMode;
  if (complexity.activeCellCount > 300 || complexity.segmentScore > 650) return "blend";
  return "split";
}

export function buildOgHeatmapGrid({
  dailyData,
  weeksToShow,
  today: providedToday,
}: BuildOgHeatmapGridParams): OgHeatmapGridResult {
  const dataMap = new Map<number, OgNormalizedCounts>();
  let maxActivity = 0;

  for (const point of dailyData) {
    const counts = normalizeCounts(point.human, point.ai, point.automation);
    dataMap.set(point.date, counts);
    if (counts.total > maxActivity) maxActivity = counts.total;
  }

  const today = providedToday ? new Date(providedToday.getTime()) : new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayDow = (today.getUTCDay() + 6) % 7; // Mon=0
  const totalDays = weeksToShow * 7 + todayDow + 1;
  const startDate = new Date(today.getTime() - (totalDays - 1) * 86_400_000);

  const cells: OgNormalizedCounts[][] = Array.from({ length: weeksToShow + 1 }, () =>
    Array.from({ length: 7 }, () => normalizeCounts(0, 0, 0))
  );

  for (let i = 0; i < totalDays; i++) {
    const cellDate = new Date(startDate.getTime() + i * 86_400_000);
    const dow = (cellDate.getUTCDay() + 6) % 7;
    const col = Math.floor(i / 7);
    if (col <= weeksToShow) {
      cells[col][dow] = dataMap.get(cellDate.getTime()) || normalizeCounts(0, 0, 0);
    }
  }

  return {
    cells,
    maxActivity,
    complexity: estimateOgComplexity(cells),
  };
}
