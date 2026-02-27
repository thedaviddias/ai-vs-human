"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink, Loader2, RefreshCw, Star } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { AiConfigStack } from "@/components/cards/AiConfigStack";
import { AIToolBreakdown } from "@/components/charts/AIToolBreakdown";
import { BotToolBreakdown } from "@/components/charts/BotToolBreakdown";
import { ContributionHeatmap } from "@/components/charts/ContributionHeatmap";
import { ContributorBreakdown } from "@/components/charts/ContributorBreakdown";
import { PrAttributionBreakdown } from "@/components/charts/PrAttributionBreakdown";
import { StatsSummary } from "@/components/charts/StatsSummary";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ShareButtons } from "@/components/sharing/ShareButtons";
import { api } from "@/convex/_generated/api";
import { postJson } from "@/lib/postJson";
import { getSyncStageLabel } from "@/lib/syncProgress";
import { trackEvent } from "@/lib/tracking";

const chartModes = ["commits", "loc"] as const;
const tabs = ["timeline", "contributors"] as const;

interface RepoDashboardContentProps {
  owner: string;
  repoName: string;
  initialRepo: FunctionReturnType<typeof api.queries.repos.getRepoBySlug>;
  initialSummary: FunctionReturnType<typeof api.queries.stats.getRepoSummary>;
  initialDailyStats: NonNullable<FunctionReturnType<typeof api.queries.stats.getDailyStats>>;
  initialContributors: NonNullable<
    FunctionReturnType<typeof api.queries.contributors.getContributorBreakdown>
  >;
}

export function RepoDashboardContent({
  owner,
  repoName,
  initialRepo,
  initialSummary,
  initialDailyStats,
  initialContributors,
}: RepoDashboardContentProps) {
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(tabs).withDefault("timeline").withOptions({ scroll: false })
  );
  const [chartMode, setChartMode] = useQueryState(
    "view",
    parseAsStringLiteral(chartModes).withDefault("commits").withOptions({ scroll: false })
  );
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const fullName = `${owner}/${repoName}`;
  const githubRepoUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`;

  // Reactive queries with initial data fallback
  const repo = useQuery(api.queries.repos.getRepoBySlug, { owner, name: repoName }) ?? initialRepo;
  const summary =
    useQuery(api.queries.stats.getRepoSummary, { repoFullName: fullName }) ?? initialSummary;
  const dailyStats =
    useQuery(api.queries.stats.getDailyStats, { repoFullName: fullName }) ?? initialDailyStats;
  const contributors =
    useQuery(api.queries.contributors.getContributorBreakdown, { repoFullName: fullName }) ??
    initialContributors;

  const handleAnalyze = async () => {
    setRequesting(true);
    setRequestError(null);
    try {
      const result = await postJson<{ status: string }>("/api/analyze/repo", {
        owner,
        name: repoName,
      });
      if (result.status !== "rate_limited") {
        trackEvent("analyze_repo", { owner, repo: repoName });
      }
      if (result.status === "rate_limited") {
        setRequestError("You've analyzed 5 new repos today. Come back tomorrow!");
        setRequesting(false);
      }
    } catch {
      setRequestError("Failed to request analysis. Please try again.");
      setRequesting(false);
    }
  };

  const [resyncRequesting, setResyncRequesting] = useState(false);
  const [resyncError, setResyncError] = useState<string | null>(null);

  const handleResync = async () => {
    setResyncRequesting(true);
    setResyncError(null);
    try {
      await postJson("/api/analyze/resync-repo", { owner, name: repoName });
      trackEvent("resync_repo", { owner, repo: repoName });
    } catch (error) {
      setResyncError(
        error instanceof Error ? error.message : "Failed to re-sync. Please try again."
      );
    } finally {
      setTimeout(() => setResyncRequesting(false), 1000);
    }
  };

  const ownerHref = `/${encodeURIComponent(owner)}`;
  const repoHref = `${ownerHref}/${encodeURIComponent(repoName)}`;
  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: owner, href: ownerHref },
    { label: repoName, href: repoHref },
  ];

  // Not found — offer to analyze
  if (repo === null) {
    return (
      <div className="py-8">
        <Breadcrumbs items={breadcrumbs} />
        <div className="mt-16 text-center">
          <h1 className="text-2xl font-bold">{fullName}</h1>
          <p className="mt-2 text-neutral-500">This repository hasn&apos;t been analyzed yet.</p>
          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-400 underline decoration-neutral-700 underline-offset-4 transition-colors hover:text-neutral-200"
          >
            View on GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={requesting}
            className="mt-6 rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {requesting ? "Requesting..." : "Analyze this repo"}
          </button>
          {requestError && <p className="mt-3 text-sm text-red-500">{requestError}</p>}
        </div>
      </div>
    );
  }

  const isSyncInProgress = repo?.syncStatus === "pending" || repo?.syncStatus === "syncing";

  return (
    <div className="py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* Repo header */}
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white">{fullName}</h1>
            {repo?.stars != null && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-sm font-bold text-amber-400 border border-amber-400/20">
                <Star className="h-3.5 w-3.5 fill-current" />
                {repo.stars.toLocaleString()}
              </div>
            )}
          </div>
          {repo?.description && (
            <p className="mt-1 text-neutral-500 max-w-3xl">{repo.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 self-start">
          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            View on GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {(repo?.syncStatus === "synced" || repo?.syncStatus === "error") && (
            <button
              type="button"
              onClick={handleResync}
              disabled={resyncRequesting}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resyncRequesting ? "animate-spin" : ""}`} />
              {repo?.syncStatus === "error" ? "Retry" : "Re-analyze"}
            </button>
          )}
        </div>
      </div>

      {resyncError && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {resyncError}
        </div>
      )}

      {/* Sync Progress Status Pill */}
      {isSyncInProgress && (
        <div className="mt-12 flex items-center justify-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400/80 animate-in fade-in slide-in-from-top-2 duration-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>
            {repo.syncStatus === "pending"
              ? "Queued for analysis"
              : getSyncStageLabel(
                  repo.syncStage as string | undefined,
                  repo.syncCommitsFetched as number | undefined
                )}
          </span>
        </div>
      )}

      <div
        id="repo-insights"
        className={`${isSyncInProgress ? "mt-6" : "mt-8"} rounded-xl border border-neutral-800 bg-neutral-900/40 p-4`}
      >
        {repo?.syncStatus === "error" && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            Sync failed: {repo.syncError ?? "Unknown error"}
          </div>
        )}

        {/* Stats */}
        {summary ? (
          <ErrorBoundary level="section">
            <StatsSummary
              totalCommits={summary.totals.total}
              botPercentage={summary.aiPercentage}
              humanPercentage={summary.humanPercentage}
              automationPercentage={summary.automationPercentage}
              trend={summary.trend}
              locBotPercentage={summary.locAiPercentage}
              locHumanPercentage={summary.locHumanPercentage}
              locAutomationPercentage={summary.locAutomationPercentage}
              totalAdditions={summary.locTotals?.totalAdditions}
              hasLocData={summary.hasLocData}
              showZeroAiWhyCta={true}
            />
          </ErrorBoundary>
        ) : isSyncInProgress ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/20"
              />
            ))}
          </div>
        ) : null}

        {/* AI Configs/Skills */}
        {repo?.aiConfigs && repo.aiConfigs.length > 0 && (
          <div className="mt-12">
            <ErrorBoundary level="section">
              <AiConfigStack configs={repo.aiConfigs} />
            </ErrorBoundary>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-12 flex items-center justify-between border-b border-neutral-800">
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className={`border-b-2 pb-2 text-sm font-bold transition-all ${
                activeTab === "timeline"
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("contributors")}
              className={`border-b-2 pb-2 text-sm font-bold transition-all ${
                activeTab === "contributors"
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Contributors
            </button>
          </div>
        </div>

        {/* Chart mode toggle */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <ErrorBoundary level="widget">
              <ShareButtons
                label={fullName}
                type="repo"
                botPercentage={summary?.aiPercentage ?? "0"}
                humanPercentage={summary?.humanPercentage ?? "0"}
                automationPercentage={summary?.automationPercentage ?? "0"}
                targetId="repo-insights"
                isSyncing={isSyncInProgress}
              />
            </ErrorBoundary>
          </div>
          {activeTab === "timeline" && summary?.hasLocData && (
            <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900 p-1">
              <button
                type="button"
                onClick={() => setChartMode("commits")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  chartMode === "commits"
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Commits
              </button>
              <button
                type="button"
                onClick={() => setChartMode("loc")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  chartMode === "loc"
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Lines of Code
              </button>
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {activeTab === "timeline" && (
            <ErrorBoundary level="widget">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                <ContributionHeatmap
                  data={dailyStats ?? []}
                  viewMode={summary?.hasLocData ? chartMode : "commits"}
                  isSyncing={isSyncInProgress}
                />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === "contributors" && (
            <ErrorBoundary level="section">
              <ContributorBreakdown contributors={contributors ?? []} />
            </ErrorBoundary>
          )}
        </div>

        {summary?.toolBreakdown && (
          <div className="mt-12">
            <AIToolBreakdown
              toolBreakdown={summary.toolBreakdown}
              viewMode={summary.hasLocData ? chartMode : "commits"}
            />
          </div>
        )}

        {(summary?.prAttribution?.totalCommits ?? 0) > 0 && (
          <div className="mt-12">
            <PrAttributionBreakdown prAttribution={summary?.prAttribution ?? null} />
          </div>
        )}

        {summary?.botBreakdown && (
          <div className="mt-12">
            <BotToolBreakdown botBreakdown={summary.botBreakdown} />
          </div>
        )}
      </div>
    </div>
  );
}
