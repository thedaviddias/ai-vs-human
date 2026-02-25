"use client";

import {
  SiClaude,
  SiCoderabbit,
  SiCursor,
  SiGithubcopilot,
  SiGooglegemini,
  SiQodo,
  SiReplit,
  SiSentry,
  SiWindsurf,
} from "@icons-pack/react-simple-icons";
import { Bot, Brain, Sparkles, Terminal } from "lucide-react";
import { useMemo } from "react";
import { type AiToolBreakdownItem, sortAiBreakdown } from "./toolBreakdownSort";

// Keys whose icons come from simple-icons (use `size` prop instead of className)
const SIMPLE_ICON_KEYS = new Set([
  "github-copilot",
  "claude-code",
  "cursor",
  "gemini",
  "coderabbit",
  "seer-by-sentry",
  "sentry-ai-reviewer",
  "qodo-merge",
  "windsurf",
  "replit-agent",
]);

interface AIToolBreakdownProps {
  toolBreakdown: AiToolBreakdownItem[];
  viewMode: "commits" | "loc";
}

const ToolIcons: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  "github-copilot": SiGithubcopilot,
  "claude-code": SiClaude,
  cursor: SiCursor,
  aider: Terminal,
  devin: Bot,
  "openai-codex": Brain,
  gemini: SiGooglegemini,
  "amazon-q-developer": Bot,
  sweep: Sparkles,
  coderabbit: SiCoderabbit,
  "seer-by-sentry": SiSentry,
  "sentry-ai-reviewer": SiSentry,
  "qodo-merge": SiQodo,
  greptile: Sparkles,
  "korbit-ai": Sparkles,
  codeium: Sparkles,
  windsurf: SiWindsurf,
  "sourcegraph-cody": Sparkles,
  tabnine: Sparkles,
  "continue-dev": Sparkles,
  "replit-agent": SiReplit,
  bolt: Sparkles,
  v0: Sparkles,
  "blackbox-ai": Sparkles,
};

const TOOL_COLORS: Record<string, string> = {
  "github-copilot": "text-[#181717] dark:text-white",
  "claude-code": "text-[#D97757]",
  cursor: "text-[#00A3FF]",
  aider: "text-green-400",
  devin: "text-purple-400",
  "openai-codex": "text-teal-400",
  gemini: "text-[#4285F4]",
  coderabbit: "text-[#FF6B2B]",
  "seer-by-sentry": "text-[#362D59]",
  "sentry-ai-reviewer": "text-[#362D59]",
  "qodo-merge": "text-[#7C3AED]",
  windsurf: "text-[#00C0FF]",
  "replit-agent": "text-[#F26207]",
};

const TOOL_URLS: Record<string, string> = {
  "github-copilot": "https://github.com/features/copilot",
  "claude-code": "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview",
  cursor: "https://cursor.com",
  aider: "https://aider.chat",
  devin: "https://devin.ai",
  "openai-codex": "https://openai.com/index/codex-cli",
  gemini: "https://gemini.google.com",
  "amazon-q-developer": "https://aws.amazon.com/q/developer",
  sweep: "https://sweep.dev",
  coderabbit: "https://coderabbit.ai",
  "seer-by-sentry": "https://sentry.io",
  "sentry-ai-reviewer": "https://sentry.io",
  "qodo-merge": "https://www.qodo.ai",
  greptile: "https://greptile.com",
  "korbit-ai": "https://korbit.ai",
  codeium: "https://codeium.com",
  windsurf: "https://windsurf.com",
  "sourcegraph-cody": "https://sourcegraph.com/cody",
  tabnine: "https://tabnine.com",
  "continue-dev": "https://continue.dev",
  "replit-agent": "https://replit.com",
  bolt: "https://bolt.new",
  v0: "https://v0.dev",
  "blackbox-ai": "https://blackbox.ai",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function AIToolBreakdown({ toolBreakdown, viewMode }: AIToolBreakdownProps) {
  const tools = useMemo(() => {
    if (!toolBreakdown || !Array.isArray(toolBreakdown)) return [];

    const filtered = toolBreakdown.filter((tool) =>
      viewMode === "commits" ? tool.commits > 0 : tool.additions > 0
    );
    return sortAiBreakdown(filtered, viewMode);
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
          const Icon = ToolIcons[tool.key] ?? Sparkles;
          const value = viewMode === "commits" ? tool.commits : tool.additions;
          const label = viewMode === "commits" ? "Commits" : "Lines Added";
          const color = TOOL_COLORS[tool.key] ?? "text-neutral-300";
          const url = TOOL_URLS[tool.key];
          const Wrapper = url ? "a" : "div";
          const wrapperProps = url
            ? { href: url, target: "_blank" as const, rel: "noopener noreferrer" }
            : {};

          return (
            <Wrapper key={tool.key} {...wrapperProps}>
              <div
                className={`flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4${url ? " transition-colors hover:border-neutral-700 hover:bg-neutral-900/60" : ""}`}
              >
                <div
                  className={`flex shrink-0 items-center justify-center rounded-lg h-10 w-10 bg-black/20 border border-neutral-800 ${color}`}
                >
                  {SIMPLE_ICON_KEYS.has(tool.key) ? (
                    <Icon size={20} />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    {tool.label}
                  </div>
                  <div className="text-lg font-bold text-white">
                    {formatNumber(value)}
                    <span className="ml-1.5 text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
                      {label}
                    </span>
                  </div>
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
