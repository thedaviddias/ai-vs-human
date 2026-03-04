import type { LucideProps } from "lucide-react";
import { Bot, Cpu, Trophy, Users } from "lucide-react";
import type { ComponentType } from "react";
import { getRank } from "../lib/ranks";

interface SummaryStatsProps {
  totalCommits: number;
  aiPercentage: string;
  humanPercentage: string;
  automationPercentage: string;
  currentStreak?: number;
  longestStreak?: number;
  totalLinesEdited?: number;
  aiLineEdits?: number;
  variant?: "profile" | "cursor";
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  textColor,
  subtext,
}: {
  label: string;
  value: string;
  icon: ComponentType<LucideProps>;
  variant?: "default" | "human" | "ai" | "bot" | "rank" | "streak" | "info";
  textColor?: string;
  subtext?: string;
}) {
  const iconColors = {
    default: "text-neutral-400",
    human: "text-green-500",
    ai: "text-purple-500",
    bot: "text-amber-500",
    rank: "text-amber-400",
    streak: "text-orange-500",
    info: "text-cyan-400",
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`rounded-lg p-2 ${iconColors[variant]} bg-black/20 border border-neutral-800`}
        >
          <Icon size={18} />
        </div>
        {subtext && <div className="text-[9px] font-medium text-neutral-600">{subtext}</div>}
      </div>
      <div className={`text-2xl font-bold tracking-tight ${textColor || "text-white"}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        {label}
      </div>
    </div>
  );
}

export function SummaryStats({
  totalCommits,
  aiPercentage,
  humanPercentage,
  automationPercentage,
  currentStreak,
  longestStreak,
  totalLinesEdited,
  aiLineEdits,
  variant = "profile",
}: SummaryStatsProps) {
  if (variant === "cursor") {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mt-6">
        <StatCard
          label="Lines Edited"
          value={formatNumber(totalLinesEdited || 0)}
          icon={Cpu}
          variant="info"
        />
        <StatCard
          label="AI Line Edits"
          value={formatNumber(aiLineEdits || 0)}
          icon={Bot}
          variant="ai"
        />
        <StatCard
          label="Current Streak"
          value={`${currentStreak || 0}d`}
          icon={Trophy}
          variant="streak"
        />
        <StatCard
          label="Longest Streak"
          value={`${longestStreak || 0}d`}
          icon={Trophy}
          variant="streak"
        />
        <StatCard
          label="Days Active"
          value={formatNumber(totalCommits)}
          icon={Users}
          variant="default"
        />
      </div>
    );
  }

  const humanPct = Number.parseFloat(humanPercentage || "0") || 0;
  const rank = getRank(humanPct);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mt-6">
      <StatCard label="Activity" value={formatNumber(totalCommits || 0)} icon={Cpu} />
      <StatCard label="Human" value={`${humanPercentage || "0"}%`} icon={Users} variant="human" />
      <StatCard label="AI" value={`${aiPercentage || "0"}%`} icon={Bot} variant="ai" />
      <StatCard label="Bot" value={`${automationPercentage || "0"}%`} icon={Bot} variant="bot" />
      <StatCard
        label={rank?.title || "Rank"}
        value={rank?.icon || "🌿"}
        icon={Trophy}
        variant="rank"
        textColor={rank?.color}
      />
    </div>
  );
}
