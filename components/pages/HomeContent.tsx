"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";
import { UserCard } from "@/components/cards/UserCard";
import { ContributionHeatmap, type DailyDataPoint } from "@/components/charts/ContributionHeatmap";
import { StatsSummary } from "@/components/charts/StatsSummary";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AiToolLogo } from "@/components/pages/leaderboard/toolVisuals";
import { api } from "@/convex/_generated/api";

const sortModes = ["latest", "followers"] as const;
const chartModes = ["commits", "loc"] as const;

interface GlobalSummaryData {
  totals: { total: number };
  aiPercentage: string;
  humanPercentage: string;
  automationPercentage: string;
  trend?: number;
  repoCount?: number;
  locAiPercentage?: string | null;
  locHumanPercentage?: string | null;
  locAutomationPercentage?: string | null;
  locTotals?: {
    totalAdditions?: number;
  };
  hasLocData?: boolean;
}

interface IndexedUserData {
  owner: string;
  avatarUrl: string;
  humanPercentage: string;
  botPercentage: string;
  automationPercentage: string;
  totalCommits: number;
  repoCount: number;
  lastIndexedAt: number;
  isSyncing: boolean;
  profile?: {
    name?: string | null;
    followers?: number;
    avatarUrl?: string;
  };
}

interface HomeContentProps {
  initialGlobalStats?: GlobalSummaryData | null;
  initialGlobalDailyStats?: DailyDataPoint[];
  initialIndexedUsers?: IndexedUserData[];
  initialGlobalToolLeaderboards?: {
    aiTools: Array<{
      key: string;
      label: string;
      commits: number;
      additions: number;
      repoCount: number;
      ownerCount: number;
    }>;
    bots: Array<{
      key: string;
      label: string;
      commits: number;
      repoCount: number;
      ownerCount: number;
    }>;
  };
}

export function HomeContent({
  initialGlobalStats,
  initialGlobalDailyStats,
  initialIndexedUsers,
  initialGlobalToolLeaderboards,
}: HomeContentProps) {
  const globalDailyStats =
    useQuery(api.queries.globalStats.getGlobalDailyStats) ?? initialGlobalDailyStats;
  const globalSummary = useQuery(api.queries.globalStats.getGlobalSummary) ?? initialGlobalStats;
  const indexedUsers =
    useQuery(api.queries.users.getIndexedUsersWithProfiles) ?? initialIndexedUsers;
  const globalToolLeaderboards =
    useQuery(api.queries.stats.getGlobalToolLeaderboards) ?? initialGlobalToolLeaderboards;

  const [sortMode, setSortMode] = useQueryState(
    "sort",
    parseAsStringLiteral(sortModes).withDefault("latest")
  );
  const [chartMode, setChartMode] = useQueryState(
    "view",
    parseAsStringLiteral(chartModes).withDefault("commits")
  );

  const dailyData = globalDailyStats ?? [];
  const hasLocData = globalSummary?.hasLocData ?? false;
  const topAiTools = useMemo(
    () => (globalToolLeaderboards?.aiTools ?? []).slice(0, 5),
    [globalToolLeaderboards?.aiTools]
  );

  const visibleUsers = useMemo(() => {
    if (!indexedUsers) return [];

    if (sortMode === "latest") {
      return indexedUsers;
    }

    return [...indexedUsers].sort((a, b) => {
      const bFollowers = b.profile?.followers ?? 0;
      const aFollowers = a.profile?.followers ?? 0;
      if (bFollowers !== aFollowers) {
        return bFollowers - aFollowers;
      }
      return b.lastIndexedAt - a.lastIndexedAt;
    });
  }, [sortMode, indexedUsers]);

  return (
    <div>
      {/* Global Stats */}
      {globalSummary && globalSummary.totals.total > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Global Insights</h2>
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800 ml-8 hidden sm:block" />
          </div>
          <ErrorBoundary level="section">
            <StatsSummary
              totalCommits={globalSummary.totals.total}
              botPercentage={globalSummary.aiPercentage}
              humanPercentage={globalSummary.humanPercentage}
              automationPercentage={globalSummary.automationPercentage}
              trend={globalSummary.trend}
              repoCount={globalSummary.repoCount}
              locBotPercentage={globalSummary.locAiPercentage}
              locHumanPercentage={globalSummary.locHumanPercentage}
              locAutomationPercentage={globalSummary.locAutomationPercentage}
              totalAdditions={globalSummary.locTotals?.totalAdditions}
              hasLocData={globalSummary.hasLocData}
              isGlobal={true}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Contribution Heatmap */}
      {dailyData.length > 0 && (
        <div className="mt-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-100">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight">
              {hasLocData && chartMode === "loc" ? "Global Activity" : "Global Commits"}
            </h2>
            {hasLocData && (
              <div className="inline-flex rounded-xl border border-neutral-200 bg-white/50 p-1 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/50">
                <button
                  type="button"
                  onClick={() => setChartMode("commits")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                    chartMode === "commits"
                      ? "bg-neutral-900 text-white shadow-sm dark:bg-neutral-100 dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  Commits
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode("loc")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                    chartMode === "loc"
                      ? "bg-white text-black shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  Code Volume
                </button>
              </div>
            )}
          </div>
          <ErrorBoundary level="widget">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8">
              <ContributionHeatmap data={dailyData} viewMode={hasLocData ? chartMode : "commits"} />
            </div>
          </ErrorBoundary>
        </div>
      )}

      {/* Top AI Tools Leaderboard Preview */}
      {topAiTools.length > 0 && (
        <div className="mt-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-150">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold tracking-tight text-white">Top AI Tools</h2>
              <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-xs font-semibold text-neutral-400">
                Global
              </span>
            </div>

            <Link
              href="/leaderboard/ai-tools"
              className="text-sm font-semibold text-neutral-400 underline underline-offset-4 transition-colors hover:text-white"
            >
              View full leaderboard
            </Link>
          </div>

          <ErrorBoundary level="section">
            <div className="overflow-hidden rounded-xl border border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900/70 text-left text-xs uppercase tracking-widest text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Tool</th>
                    <th className="px-4 py-3">Commits</th>
                    <th className="px-4 py-3">Code Volume</th>
                    <th className="px-4 py-3">Repos</th>
                  </tr>
                </thead>
                <tbody>
                  {topAiTools.map((tool, index) => (
                    <tr
                      key={tool.key}
                      className="border-t border-neutral-800/80 hover:bg-neutral-900/40"
                    >
                      <td className="px-4 py-3 font-semibold text-neutral-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <AiToolLogo toolKey={tool.key} label={tool.label} />
                          <span className="font-semibold text-white">{tool.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-200">
                        {tool.commits.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-neutral-300">
                        {tool.additions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-neutral-300">
                        {tool.repoCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Based on indexed public repositories currently tracked in AI vs Human.
            </p>
          </ErrorBoundary>
        </div>
      )}

      {/* Indexed Users Grid */}
      {indexedUsers && indexedUsers.length > 0 && (
        <div className="mt-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold tracking-tight text-white">Recent Generations</h2>
              <span className="rounded-full bg-neutral-900 border border-neutral-800 px-2.5 py-0.5 text-xs font-semibold text-neutral-400">
                {indexedUsers.length}
              </span>
            </div>

            <div className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900 p-1">
              <button
                type="button"
                onClick={() => setSortMode("latest")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  sortMode === "latest"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Latest
              </button>
              <button
                type="button"
                onClick={() => setSortMode("followers")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  sortMode === "followers"
                    ? "bg-white text-black shadow-sm"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Top followers
              </button>
            </div>
          </div>

          <ErrorBoundary level="section">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleUsers.map((user) => {
                return (
                  <UserCard
                    key={user.owner}
                    owner={user.owner}
                    avatarUrl={user.profile?.avatarUrl ?? user.avatarUrl}
                    displayName={user.profile?.name ?? undefined}
                    followers={user.profile?.followers}
                    humanPercentage={user.humanPercentage}
                    botPercentage={user.botPercentage}
                    automationPercentage={user.automationPercentage}
                    totalCommits={user.totalCommits}
                    repoCount={user.repoCount}
                    lastIndexedAt={user.lastIndexedAt}
                    isSyncing={user.isSyncing}
                  />
                );
              })}
            </div>
          </ErrorBoundary>
        </div>
      )}

      {/* Informational Footer Link */}
      <div className="mt-24 border-t border-neutral-800 pt-12 text-center">
        <p className="text-sm text-neutral-500">
          Learn how scoring works in{" "}
          <Link href="/docs" className="underline underline-offset-4 hover:text-neutral-300">
            Docs
          </Link>{" "}
          and explore the{" "}
          <Link href="/docs/ranks" className="underline underline-offset-4 hover:text-neutral-300">
            rank model
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
