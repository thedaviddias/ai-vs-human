"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface GlobalDataPoint {
  weekLabel: string;
  human: number;
  aiAssisted: number;
  // LOC fields (optional — absent when LOC data not available)
  humanAdditions?: number;
  aiAdditions?: number;
}

/**
 * Simplifies the full breakdown into 2 categories for the hero chart:
 * - Human: commits by humans
 * - AI-Assisted: copilot + claude + cursor + ai-assisted (generic)
 *
 * Also aggregates LOC (additions) into the same 2 categories.
 *
 * Automation bots (dependabot, renovate, github-actions, other-bot) are
 * excluded entirely — they're dependency bumps and CI artifacts, not code.
 */
export function transformToHeroData(
  data: Array<{
    weekLabel: string;
    human: number;
    aiAssisted: number;
    copilot: number;
    claude: number;
    cursor?: number;
    dependabot: number;
    renovate: number;
    githubActions: number;
    otherBot: number;
    // LOC fields
    humanAdditions?: number;
    copilotAdditions?: number;
    claudeAdditions?: number;
    cursorAdditions?: number;
    aiAssistedAdditions?: number;
  }>
): GlobalDataPoint[] {
  return data.map((d) => ({
    weekLabel: d.weekLabel,
    human: d.human,
    aiAssisted: d.aiAssisted + d.copilot + d.claude + (d.cursor ?? 0),
    // LOC: aggregate AI tool additions into one value
    humanAdditions: d.humanAdditions ?? 0,
    aiAdditions:
      (d.aiAssistedAdditions ?? 0) +
      (d.copilotAdditions ?? 0) +
      (d.claudeAdditions ?? 0) +
      (d.cursorAdditions ?? 0),
  }));
}

/**
 * Formats "2025-W14" → "Apr '25"
 */
function formatWeekToMonth(weekLabel: string): string {
  const match = weekLabel.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekLabel;
  const year = Number.parseInt(match[1], 10);
  const week = Number.parseInt(match[2], 10);
  const date = new Date(year, 0, 1 + (week - 1) * 7);
  const month = date.toLocaleString("en-US", { month: "short" });
  const shortYear = String(year).slice(2);
  return `${month} '${shortYear}`;
}

function formatLoc(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: GlobalDataPoint;
  }>;
  label?: string;
  viewMode: "commits" | "loc";
}

function CustomTooltip({ active, payload, label, viewMode }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  const isLoc = viewMode === "loc";

  const humanVal = isLoc ? (data.humanAdditions ?? 0) : data.human;
  const aiVal = isLoc ? (data.aiAdditions ?? 0) : data.aiAssisted;
  const total = humanVal + aiVal;
  const pct = (val: number) => (total > 0 ? ((val / total) * 100).toFixed(0) : "0");
  const unit = isLoc ? "lines added" : "code commits";
  const fmtVal = (val: number) => (isLoc ? formatLoc(val) : String(val));

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm shadow-xl">
      <div className="mb-1.5 font-semibold text-neutral-200">
        {label ? formatWeekToMonth(label) : ""}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "#4ade80" }}
            />
            <span className="text-neutral-400">Human</span>
          </span>
          <span className="font-medium text-neutral-200">
            {fmtVal(humanVal)} <span className="text-neutral-500">({pct(humanVal)}%)</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "#a78bfa" }}
            />
            <span className="text-neutral-400">AI-Assisted</span>
          </span>
          <span className="font-medium text-neutral-200">
            {fmtVal(aiVal)} <span className="text-neutral-500">({pct(aiVal)}%)</span>
          </span>
        </div>
        <div className="mt-1 border-t border-neutral-700 pt-1 text-right text-xs text-neutral-500">
          {isLoc ? formatLoc(total) : total} {unit} (excl. bots)
        </div>
      </div>
    </div>
  );
}

interface HeroChartProps {
  data: GlobalDataPoint[];
  /** Use percentage stacking so proportions are always visible */
  percentageMode?: boolean;
  /** Toggle between commit count and lines of code view */
  viewMode?: "commits" | "loc";
}

export function HeroChart({ data, percentageMode = false, viewMode = "commits" }: HeroChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-neutral-500">
        Analyzing repositories...
      </div>
    );
  }

  const isLoc = viewMode === "loc";
  const humanKey = isLoc ? "humanAdditions" : "human";
  const aiKey = isLoc ? "aiAdditions" : "aiAssisted";

  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={data} stackOffset={percentageMode ? "expand" : "none"}>
        <defs>
          <linearGradient id="gradHuman" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#4ade80" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gradAI" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
        <XAxis
          dataKey="weekLabel"
          tickFormatter={formatWeekToMonth}
          tick={{ fontSize: 11, fill: "#737373" }}
          axisLine={{ stroke: "#262626" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={60}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#737373" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={
            percentageMode
              ? (v: number) => `${(v * 100).toFixed(0)}%`
              : isLoc
                ? (v: number) => formatLoc(v)
                : undefined
          }
          width={45}
        />
        <Tooltip
          content={<CustomTooltip viewMode={viewMode} />}
          cursor={{ stroke: "#525252", strokeDasharray: "4 4" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          type="monotone"
          dataKey={aiKey}
          stackId="1"
          stroke="#a78bfa"
          strokeWidth={1.5}
          fill="url(#gradAI)"
          name="AI-Assisted"
        />
        <Area
          type="monotone"
          dataKey={humanKey}
          stackId="1"
          stroke="#4ade80"
          strokeWidth={2}
          fill="url(#gradHuman)"
          name="Human"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
