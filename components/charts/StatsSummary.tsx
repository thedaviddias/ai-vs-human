"use client";

import { Bot, CircleHelp, Cpu, Globe, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { AttributionGuidanceModal } from "@/components/ui/AttributionGuidanceModal";
import { getRank } from "@/lib/ranks";
import { trackEvent } from "@/lib/tracking";
import {
  getAttributionGuidanceType,
  hasSeenAttributionGuidance,
  markAttributionGuidanceSeen,
  shouldShowAttributionGuidance,
} from "@/lib/zeroAiGuidance";

interface StatsSummaryProps {
  totalCommits: number;
  botPercentage: string; // This is AI
  humanPercentage: string;
  automationPercentage?: string;
  trend?: number;
  repoCount?: number;
  // LOC metrics (optional — graceful degradation when absent)
  locBotPercentage?: string | null;
  locHumanPercentage?: string | null;
  locAutomationPercentage?: string | null;
  totalAdditions?: number;
  hasLocData?: boolean;
  isGlobal?: boolean;
  showZeroAiWhyCta?: boolean;
  zeroAiWhyHref?: string;
  /** When present and > 0, the "Total Activity" card shows public+private breakdown */
  privateCommitCount?: number;
  /** Context for tracking — "repo" or "user" dashboard */
  guidanceContext?: "repo" | "user";
  /** When true, delays modal auto-open until sync completes */
  isSyncing?: boolean;
  /** Self-reported AI tools from the user (displayed as supplementary info) */
  selfReportedTools?: string[];
  /** Self-reported estimated AI percentage */
  selfReportedPercentage?: number;
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
  subtext?: ReactNode;
  tooltip: string;
  variant?: "default" | "human" | "ai" | "bot" | "accent" | "rank" | "global";
  textColor?: string;
}) {
  const iconColors = {
    default: "text-neutral-400",
    human: "text-green-500",
    ai: "text-purple-500",
    bot: "text-amber-500",
    accent: "text-blue-500",
    rank: "text-amber-400",
    global: "text-blue-400",
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
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
          <span className="truncate">{label}</span>
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
  botPercentage, // AI
  humanPercentage,
  automationPercentage = "0",
  trend: _trend,
  repoCount,
  locBotPercentage,
  locHumanPercentage,
  locAutomationPercentage,
  totalAdditions,
  hasLocData,
  isGlobal = false,
  showZeroAiWhyCta = false,
  zeroAiWhyHref = "/docs/attribution",
  privateCommitCount,
  guidanceContext = "repo",
  isSyncing = false,
  selfReportedTools,
  selfReportedPercentage,
}: StatsSummaryProps) {
  const [isGuidanceModalOpen, setIsGuidanceModalOpen] = useState(false);

  const showGuidance = shouldShowAttributionGuidance({
    showZeroAiWhyCta,
    botPercentage,
    totalCommits,
  });
  const guidanceType = getAttributionGuidanceType(botPercentage);

  // Auto-open modal once for zero-AI users (wait for sync to finish)
  useEffect(() => {
    if (isSyncing) return;
    if (guidanceType === "zero" && showGuidance && !hasSeenAttributionGuidance()) {
      setIsGuidanceModalOpen(true);
      markAttributionGuidanceSeen();
      trackEvent("attribution_guidance_shown", { context: guidanceContext });
    }
  }, [guidanceType, showGuidance, guidanceContext, isSyncing]);

  const handleGuidanceDismiss = useCallback(() => {
    setIsGuidanceModalOpen(false);
    trackEvent("attribution_guidance_dismissed", { action: "dismiss" });
  }, []);

  const handleGuidanceLearnMore = useCallback(() => {
    setIsGuidanceModalOpen(false);
    trackEvent("attribution_guidance_dismissed", { action: "learn_more" });
  }, []);

  // Commits as primary, LOC as secondary subtext (following GitHub convention)
  const humanValue = `${humanPercentage}%`;
  const humanSubtext: ReactNode =
    showGuidance && guidanceType !== "none" ? (
      <span className="text-[10px] font-bold uppercase tracking-widest text-green-500/80">
        Manual Work
      </span>
    ) : hasLocData && locHumanPercentage ? (
      `${locHumanPercentage}% code`
    ) : undefined;

  const aiValue = `${botPercentage}%`;
  const hasSelfReport = selfReportedTools && selfReportedTools.length > 0;
  const aiSubtext: ReactNode =
    hasSelfReport && (guidanceType === "zero" || guidanceType === "low") ? (
      <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400/60">
        Self-reported: ~{selfReportedPercentage ?? "?"}%
      </span>
    ) : showGuidance ? (
      <Link
        href={zeroAiWhyHref}
        className="text-[10px] font-bold uppercase tracking-widest text-purple-400/80 transition-colors hover:text-purple-300"
        aria-label={
          guidanceType === "zero" ? "Learn why AI can show as 0%" : "Learn about AI attribution"
        }
      >
        {guidanceType === "zero" ? "Why 0% AI?" : "Low AI attribution?"}
      </Link>
    ) : hasLocData && locBotPercentage ? (
      `${locBotPercentage}% code`
    ) : undefined;

  const automationValue = `${automationPercentage}%`;
  const automationSubtext =
    hasLocData && locAutomationPercentage ? `${locAutomationPercentage}% code` : undefined;

  const humanLabel = "Human Commits";
  const aiLabel = "Detected AI";
  const automationLabel = "Bot Commits";

  // Calculate Rank
  const humanPct = Number.parseFloat(
    hasLocData && locHumanPercentage ? locHumanPercentage : humanPercentage
  );
  const rank = getRank(humanPct);
  const additionsContext = hasLocData
    ? ` Based on ${formatNumber(totalAdditions ?? 0)} total added lines.`
    : "";

  const hasPrivateEnrichment = privateCommitCount != null && privateCommitCount > 0;
  // totalCommits already includes private data (merged via mergePublicAndPrivateWeeklyStats
  // on the client). privateCommitCount is only used for the badge/tooltip — NOT added to
  // the total, as that would double-count private commits.
  const displayedTotal = totalCommits;

  const totalCommitsTooltip = hasPrivateEnrichment
    ? `Includes both public and private repo activity (${formatNumber(privateCommitCount)} from private repos). Only aggregate counts are stored — no private code or repo names.`
    : `Total analyzed activity across ${
        repoCount ? `${repoCount} repositories` : "the selected repositories"
      }. Includes human manual work, AI assistance, and maintenance bots.`;

  const humanTooltip =
    showGuidance && guidanceType !== "none"
      ? "High percentage of manual work. This reflects direct human craftsmanship and manual effort."
      : hasLocData && locHumanPercentage
        ? `Percent of added lines attributed to humans.${additionsContext}`
        : "Percent of analyzed commits attributed to humans.";

  const aiBaseTooltip =
    hasLocData && locBotPercentage
      ? `Percent of added lines attributed to AI assistants (Copilot, Cursor, etc.), based on commit attribution markers.${additionsContext}`
      : "Percent of analyzed commits with detected AI attribution markers (Co-Authored-By, commit message tags).";
  const aiTooltip =
    guidanceType === "zero"
      ? `${aiBaseTooltip} Showing 0%? Your AI tools might be missing attribution markers.`
      : guidanceType === "low"
        ? `${aiBaseTooltip} Low percentage? Most work was done manually, or attribution markers are missing.`
        : aiBaseTooltip;

  const automationTooltip =
    hasLocData && locAutomationPercentage
      ? `Percent of added lines from automation bots (Dependabot, Renovate, etc.).${additionsContext}`
      : "Percent of analyzed commits from maintenance bots.";

  const rankTooltip = isGlobal
    ? "Aggregated global view across all indexed repositories currently tracked in AI vs Human."
    : "Developer rank is derived from the Human percentage shown in this summary.";

  return (
    <>
      <AttributionGuidanceModal
        isOpen={isGuidanceModalOpen}
        onClose={handleGuidanceDismiss}
        onLearnMore={handleGuidanceLearnMore}
      />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Activity"
          value={formatNumber(displayedTotal)}
          icon={<Cpu className="h-5 w-5" />}
          subtext={
            hasPrivateEnrichment ? (
              <span className="text-purple-400/80">
                incl. {formatNumber(privateCommitCount)} private
              </span>
            ) : repoCount ? (
              `${repoCount} repos`
            ) : undefined
          }
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
        <StatCard
          label={automationLabel}
          value={automationValue}
          icon={<Bot className="h-5 w-5" />}
          subtext={automationSubtext}
          variant="bot"
          tooltip={automationTooltip}
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
    </>
  );
}
