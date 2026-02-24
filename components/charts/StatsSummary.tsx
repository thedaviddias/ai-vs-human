"use client";

import { Bot, CircleHelp, Cpu, Globe, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";
import { getRank } from "@/lib/ranks";

interface StatsSummaryProps {
  totalCommits: number;
  botPercentage: string;
  humanPercentage: string;
  trend?: number;
  repoCount?: number;
  // LOC metrics (optional — graceful degradation when absent)
  locBotPercentage?: string | null;
  locHumanPercentage?: string | null;
  totalAdditions?: number;
  hasLocData?: boolean;
  isGlobal?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function StatCard({
  label,
  value,
  icon,
  subtext,
  tooltip,
  variant = "default",
  textColor,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  subtext?: string;
  tooltip: string;
  variant?: "default" | "human" | "ai" | "accent" | "rank" | "global";
  textColor?: string;
}) {
  const iconColors = {
    default: "text-neutral-400",
    human: "text-green-500",
    ai: "text-purple-500",
    accent: "text-blue-500",
    rank: "text-amber-400",
    global: "text-blue-400",
  };

  return (
    <div className="relative overflow-visible rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
      <div className="flex items-center justify-between">
        <div
          className={`rounded-lg p-2 ${iconColors[variant]} bg-black/20 border border-neutral-800`}
        >
          {icon}
        </div>
        {subtext && (
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
            {subtext}
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className={`text-3xl font-bold tracking-tight ${textColor || "text-white"}`}>
          {value}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-neutral-500">
          <span>{label}</span>
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label={`How ${label} is calculated`}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-neutral-500/80 transition-colors hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70"
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 translate-y-1 rounded-lg border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-[11px] font-normal leading-relaxed text-neutral-200 opacity-0 shadow-xl backdrop-blur transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              {tooltip}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function StatsSummary({
  totalCommits,
  botPercentage,
  humanPercentage,
  trend: _trend,
  repoCount,
  locBotPercentage,
  locHumanPercentage,
  totalAdditions,
  hasLocData,
  isGlobal = false,
}: StatsSummaryProps) {
  // When LOC data is available, show LOC percentages as primary and commit % as subtext
  const humanValue =
    hasLocData && locHumanPercentage ? `${locHumanPercentage}%` : `${humanPercentage}%`;
  const humanSubtext = hasLocData && locHumanPercentage ? `${humanPercentage}% commits` : undefined;

  const aiValue = hasLocData && locBotPercentage ? `${locBotPercentage}%` : `${botPercentage}%`;
  const aiSubtext = hasLocData && locBotPercentage ? `${botPercentage}% commits` : undefined;

  const humanLabel = hasLocData ? "Human Code Contribution" : "Human Commits";
  const aiLabel = hasLocData ? "AI/Bot Code Contribution" : "AI/Bot Commits";

  // Calculate Rank
  const humanPct = Number.parseFloat(
    hasLocData && locHumanPercentage ? locHumanPercentage : humanPercentage
  );
  const rank = getRank(humanPct);
  const additionsContext = hasLocData
    ? ` Based on ${formatNumber(totalAdditions ?? 0)} total added lines.`
    : "";

  const totalCommitsTooltip = `Total analyzed commits across ${
    repoCount ? `${repoCount} repositories` : "the selected repositories"
  }. Formula: human commits + AI-tool commits (Copilot, Claude, Cursor, AI-assisted).`;

  const humanTooltip =
    hasLocData && locHumanPercentage
      ? `Percent of added lines attributed to humans. Formula: human additions / (human additions + AI additions) × 100.${additionsContext}`
      : "Percent of analyzed commits attributed to humans. Formula: human commits / (human commits + AI-tool commits) × 100.";

  const aiTooltip =
    hasLocData && locBotPercentage
      ? `Percent of added lines attributed to AI tools. Formula: AI additions / (human additions + AI additions) × 100.${additionsContext}`
      : "Percent of analyzed commits attributed to AI tools. Formula: AI-tool commits / (human commits + AI-tool commits) × 100.";

  const rankTooltip = isGlobal
    ? "Aggregated global view across all indexed repositories currently tracked in AI vs Human."
    : "Developer rank is derived from the Human percentage shown in this summary.";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Commits"
        value={formatNumber(totalCommits)}
        icon={<Cpu className="h-5 w-5" />}
        subtext={repoCount ? `${repoCount} repos` : undefined}
        tooltip={totalCommitsTooltip}
      />
      <StatCard
        label={humanLabel}
        value={humanValue}
        icon={<Users className="h-5 w-5" />}
        subtext={humanSubtext}
        variant="human"
        tooltip={humanTooltip}
      />
      <StatCard
        label={aiLabel}
        value={aiValue}
        icon={<Bot className="h-5 w-5" />}
        subtext={aiSubtext}
        variant="ai"
        tooltip={aiTooltip}
      />
      {isGlobal ? (
        <StatCard
          label="Community Scale"
          value="Global"
          icon={<Globe className="h-5 w-5" />}
          subtext="Total Index"
          variant="global"
          tooltip={rankTooltip}
        />
      ) : (
        <StatCard
          label={rank.title}
          value={rank.icon}
          icon={<Trophy className="h-5 w-5" />}
          subtext="Developer Rank"
          variant="rank"
          textColor={rank.color}
          tooltip={rankTooltip}
        />
      )}
    </div>
  );
}
