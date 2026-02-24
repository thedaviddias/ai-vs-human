"use client";

import {
  SiClaude,
  SiCursor,
  SiGithubcopilot,
  SiGooglegemini,
} from "@icons-pack/react-simple-icons";
import { Bot, Brain, Sparkles, Terminal } from "lucide-react";
import { useMemo } from "react";

interface ToolStats {
  commits: number;
  additions: number;
}

interface AIToolBreakdownProps {
  toolBreakdown: {
    copilot: ToolStats;
    claude: ToolStats;
    cursor: ToolStats;
    aider: ToolStats;
    devin: ToolStats;
    openaiCodex: ToolStats;
    gemini: ToolStats;
    aiAssisted: ToolStats;
  };
  viewMode: "commits" | "loc";
}

type ToolIconId =
  | "copilot"
  | "claude"
  | "cursor"
  | "aider"
  | "devin"
  | "openaiCodex"
  | "gemini"
  | "aiAssisted";

const ToolIcons: Record<ToolIconId, React.ComponentType<{ className?: string; size?: number }>> = {
  copilot: SiGithubcopilot,
  claude: SiClaude,
  cursor: SiCursor,
  aider: Terminal,
  devin: Bot,
  openaiCodex: Brain,
  gemini: SiGooglegemini,
  aiAssisted: Sparkles,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function AIToolBreakdown({ toolBreakdown, viewMode }: AIToolBreakdownProps) {
  const tools = useMemo(() => {
    if (!toolBreakdown) return [];

    const data = [
      {
        id: "copilot",
        name: "GitHub Copilot",
        stats: toolBreakdown.copilot,
        color: "text-[#181717] dark:text-white",
      },
      { id: "claude", name: "Claude Code", stats: toolBreakdown.claude, color: "text-[#D97757]" },
      { id: "cursor", name: "Cursor", stats: toolBreakdown.cursor, color: "text-[#00A3FF]" },
      { id: "aider", name: "Aider", stats: toolBreakdown.aider, color: "text-green-400" },
      { id: "devin", name: "Devin", stats: toolBreakdown.devin, color: "text-purple-400" },
      {
        id: "openaiCodex",
        name: "Codex",
        stats: toolBreakdown.openaiCodex,
        color: "text-teal-400",
      },
      { id: "gemini", name: "Gemini", stats: toolBreakdown.gemini, color: "text-[#4285F4]" },
      {
        id: "aiAssisted",
        name: "Other AI Tools",
        stats: toolBreakdown.aiAssisted,
        color: "text-neutral-400",
      },
    ];

    // Filter out tools with 0 usage or missing stats
    return data.filter((t) => {
      const stats = t.stats;
      if (!stats) return false;
      const value = viewMode === "commits" ? (stats.commits ?? 0) : (stats.additions ?? 0);
      return value > 0;
    });
  }, [toolBreakdown, viewMode]);

  if (tools.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-500">
          AI Tooling Breakdown
        </h3>
        <div className="h-px flex-1 bg-neutral-800/50" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => {
          const Icon = ToolIcons[tool.id as ToolIconId];
          const value =
            viewMode === "commits" ? (tool.stats?.commits ?? 0) : (tool.stats?.additions ?? 0);
          const label = viewMode === "commits" ? "Commits" : "Lines Added";

          return (
            <div
              key={tool.id}
              className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
            >
              <div
                className={`flex shrink-0 items-center justify-center rounded-lg h-10 w-10 bg-black/20 border border-neutral-800 ${tool.color}`}
              >
                {/* Check if it's a simple-icon (has size prop) or lucide icon */}
                {tool.id === "copilot" ||
                tool.id === "claude" ||
                tool.id === "cursor" ||
                tool.id === "gemini" ? (
                  <Icon size={20} />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  {tool.name}
                </div>
                <div className="text-lg font-bold text-white">
                  {formatNumber(value)}
                  <span className="ml-1.5 text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
                    {label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
