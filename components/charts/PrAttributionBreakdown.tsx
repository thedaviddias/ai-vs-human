"use client";

import { Bot, Sparkles } from "lucide-react";

interface PrAttributionBreakdownProps {
  prAttribution:
    | {
        totalCommits: number;
        aiCommits: number;
        automationCommits: number;
        breakdown: Array<{
          key: string;
          label: string;
          lane: "ai" | "automation";
          commits: number;
        }>;
        computedAt: number;
      }
    | null
    | undefined;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function PrAttributionBreakdown({ prAttribution }: PrAttributionBreakdownProps) {
  if (!prAttribution || prAttribution.totalCommits <= 0) return null;

  const entries = prAttribution.breakdown.filter((entry) => entry.commits > 0);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-500">
          PR Attribution Signals
        </h3>
        <div className="h-px flex-1 bg-neutral-800/50" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            PR-attributed commits
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatNumber(prAttribution.totalCommits)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            AI from PR
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {formatNumber(prAttribution.aiCommits)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            Automation from PR
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-400">
            {formatNumber(prAttribution.automationCommits)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
        {entries.map((entry) => (
          <div
            key={entry.key}
            className="flex items-center justify-between gap-3 border-b border-neutral-800/80 px-4 py-3 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                  entry.lane === "ai"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                }`}
              >
                {entry.lane === "ai" ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{entry.label}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  {entry.lane === "ai" ? "AI" : "Automation"}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-sm font-bold text-neutral-200">
              {formatNumber(entry.commits)}
              <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                commits
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
