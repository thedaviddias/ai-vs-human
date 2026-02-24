"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CLASSIFICATION_COLORS: Record<string, string> = {
  human: "#10b981", // Emerald 500
  humanAdditions: "#10b981",
  copilot: "#3b82f6", // Blue 500
  copilotAdditions: "#3b82f6",
  claude: "#f97316", // Orange 500
  claudeAdditions: "#f97316",
  cursor: "#06b6d4", // Cyan 500
  cursorAdditions: "#06b6d4",
  aider: "#059669", // Emerald 600
  aiderAdditions: "#059669",
  devin: "#6366f1", // Indigo 500
  devinAdditions: "#6366f1",
  openaiCodex: "#14b8a6", // Teal 500
  openaiCodexAdditions: "#14b8a6",
  gemini: "#3b82f6", // Blue 500
  geminiAdditions: "#3b82f6",
  aiAssisted: "#a855f7", // Purple 500
  aiAssistedAdditions: "#a855f7",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  human: "Human",
  humanAdditions: "Human",
  copilot: "Copilot",
  copilotAdditions: "Copilot",
  claude: "Claude Code",
  claudeAdditions: "Claude Code",
  cursor: "Cursor",
  cursorAdditions: "Cursor",
  aider: "Aider",
  aiderAdditions: "Aider",
  devin: "Devin",
  devinAdditions: "Devin",
  openaiCodex: "Codex",
  openaiCodexAdditions: "Codex",
  gemini: "Gemini",
  geminiAdditions: "Gemini",
  aiAssisted: "AI Assisted",
  aiAssistedAdditions: "AI Assisted",
};

export interface ChartDataPoint {
  weekLabel: string;
  human: number;
  copilot: number;
  claude: number;
  cursor: number;
  aider?: number;
  devin?: number;
  openaiCodex?: number;
  gemini?: number;
  aiAssisted: number;
  total: number;
  humanAdditions: number;
  copilotAdditions: number;
  claudeAdditions: number;
  cursorAdditions: number;
  aiderAdditions?: number;
  devinAdditions?: number;
  openaiCodexAdditions?: number;
  geminiAdditions?: number;
  aiAssistedAdditions: number;
}

const RENDER_ORDER_COMMITS = [
  "claude",
  "copilot",
  "cursor",
  "aider",
  "devin",
  "openaiCodex",
  "gemini",
  "aiAssisted",
  "human",
];
const RENDER_ORDER_LOC = [
  "claudeAdditions",
  "copilotAdditions",
  "cursorAdditions",
  "aiderAdditions",
  "devinAdditions",
  "openaiCodexAdditions",
  "geminiAdditions",
  "aiAssistedAdditions",
  "humanAdditions",
];

interface BotVsHumanChartProps {
  data: ChartDataPoint[];
  viewMode: "commits" | "loc";
}

export function BotVsHumanChart({ data, viewMode }: BotVsHumanChartProps) {
  const keys = viewMode === "commits" ? RENDER_ORDER_COMMITS : RENDER_ORDER_LOC;

  const chartData = useMemo(() => {
    return data.map((d) => {
      const point: Record<string, string | number> = { weekLabel: d.weekLabel };
      for (const key of keys) {
        point[key] = (d[key as keyof ChartDataPoint] as number) || 0;
      }
      return point;
    });
  }, [data, keys]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-neutral-500">
        No contribution data available for this period.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={0}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
          <XAxis
            dataKey="weekLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#737373", fontSize: 10 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#737373", fontSize: 10 }}
            dx={-10}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            contentStyle={{
              backgroundColor: "#0a0a0a",
              border: "1px solid #262626",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            itemStyle={{ padding: "2px 0" }}
            labelStyle={{ fontWeight: "bold", marginBottom: "4px", color: "#fff" }}
            formatter={
              ((value: number | undefined, name: string | undefined) => [
                (value ?? 0).toLocaleString(),
                CLASSIFICATION_LABELS[name ?? ""] || name || "",
              ]) as never
            }
          />
          {keys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="a"
              fill={CLASSIFICATION_COLORS[key]}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
