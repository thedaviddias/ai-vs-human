"use client";

import { useQuery } from "convex/react";
import { Bell, CheckCircle2, Clock, Loader2, RefreshCw, Star, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HumanAiBadges } from "@/components/badges/HumanAiBadges";
import { UserCard } from "@/components/cards/UserCard";
import { AIToolBreakdown } from "@/components/charts/AIToolBreakdown";
import { BotToolBreakdown } from "@/components/charts/BotToolBreakdown";
import { ContributionHeatmap } from "@/components/charts/ContributionHeatmap";
import { StatsSummary } from "@/components/charts/StatsSummary";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ShareButtons } from "@/components/sharing/ShareButtons";
import { OwnerPageSkeleton } from "@/components/skeletons/PageSkeletons";
import { NotificationModal } from "@/components/ui/NotificationModal";
import { api } from "@/convex/_generated/api";
import { aggregateMultiRepoStats, computeUserSummary } from "@/lib/aggregateUserStats";
import { useSound } from "@/lib/hooks/useSound";
import { logger } from "@/lib/logger";
import { postJson } from "@/lib/postJson";
import { getSyncBadgeLabel, getSyncStageLabel } from "@/lib/syncProgress";
import { trackEvent } from "@/lib/tracking";
import { createUserAutoAnalyzePlan } from "@/lib/userAutoAnalyzePlan";
import { formatPercentage } from "@/lib/utils";

const SYNC_FUN_MESSAGES = [
  "Counting ones and zeros...",
  "Teaching robots to read git logs...",
  "Asking GitHub very politely...",
  "Sorting spaghetti code from linguine code...",
  "Converting coffee into commit data...",
  "Peeking behind the curtain of your repos...",
  "Decoding your developer DNA...",
  "This is faster than a code review, promise...",
  "Running git blame on your entire career...",
  "Finding the human behind the machine...",
  "Measuring the AI vibes in your codebase...",
  "Your commits are telling a great story...",
  "Calculating your human-to-robot ratio...",
  "Almost there... just one more API call...",
  "Doing science with your commit history...",
  "Scanning for traces of Copilot...",
  "Your repos have quite the personality...",
  "Impressive commit streak, by the way...",
  "Separating human art from AI craft...",
  "Crunching numbers at the speed of git...",
];

/** Cycles through fun messages at a regular interval while syncing */
function useFunSyncMessage(isActive: boolean) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * SYNC_FUN_MESSAGES.length));

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % SYNC_FUN_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isActive]);

  return SYNC_FUN_MESSAGES[index];
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
  pushed_at: string | null;
}

const chartModes = ["commits", "loc"] as const;
const repoSortModes = ["latest", "stars"] as const;

export function UserDashboardContent({ owner }: { owner: string }) {
  const [sortMode, setSortMode] = useQueryState(
    "sort",
    parseAsStringLiteral(repoSortModes).withDefault("latest")
  );
  const ownerHref = `/${encodeURIComponent(owner)}`;
  const ownerBreadcrumbs = [
    { label: "Home", href: "/" },
    { label: owner, href: ownerHref },
  ];

  // Phase 1: Fetch public repos from GitHub (to keep sync triggering logic)
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Phase 2: Fetch cached profile from Convex + Local fallback
  const cachedProfile = useQuery(api.queries.users.getProfile, { owner: owner });
  const [localProfile, setLocalProfile] = useState<{
    name: string | null;
    avatar_url: string;
  } | null>(null);

  useEffect(() => {
    async function fetchGitHubRepos() {
      try {
        const [reposRes, userRes] = await Promise.all([
          fetch(`https://api.github.com/users/${owner}/repos?per_page=100&type=public`),
          fetch(`https://api.github.com/users/${owner}`),
        ]);

        if (reposRes.status === 404) {
          setGithubError(`GitHub user "${owner}" not found.`);
          setGithubLoading(false);
          return;
        }

        if (!reposRes.ok) {
          setGithubError(`Failed to fetch repos: ${reposRes.statusText}`);
          setGithubLoading(false);
          return;
        }

        const [reposData, userData] = await Promise.all([
          reposRes.json() as Promise<GitHubRepo[]>,
          userRes.ok
            ? (userRes.json() as Promise<{ name: string | null; avatar_url: string }>)
            : null,
        ]);

        // Exclude forks, sort by stars descending, take top 20
        const ownRepos = reposData
          .filter((r) => !r.fork)
          .sort((a, b) => b.stargazers_count - a.stargazers_count)
          .slice(0, 20);

        setGithubRepos(ownRepos);
        if (userData) setLocalProfile(userData);
      } catch {
        setGithubError("Failed to fetch data from GitHub.");
      } finally {
        setGithubLoading(false);
      }
    }

    fetchGitHubRepos();
  }, [owner]);

  const githubDisplayName = cachedProfile?.name ?? localProfile?.name ?? null;
  const githubAvatarUrl =
    cachedProfile?.avatarUrl ??
    localProfile?.avatar_url ??
    `https://github.com/${owner}.png?size=160`;

  const [isFirstIngestion, setIsFirstIngestion] = useState(false);

  useEffect(() => {
    if (!owner) return;
    setHasTriggered(false);
    setIsFirstIngestion(false);
  }, [owner]);

  const [chartMode, setChartMode] = useQueryState(
    "view",
    parseAsStringLiteral(chartModes).withDefault("commits")
  );

  // Resync: allows user to re-trigger analysis with latest classification
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncError, setResyncError] = useState<string | null>(null);

  const handleResync = useCallback(async () => {
    trackEvent("resync", { owner: owner });
    setIsResyncing(true);
    setResyncError(null);
    try {
      // Reset existing repos and queue analysis in one protected server flow.
      await postJson("/api/analyze/resync-user", {
        owner: owner,
        repos: githubRepos.map((repo) => ({
          owner: owner,
          name: repo.name,
          ...(repo.pushed_at ? { pushedAt: new Date(repo.pushed_at).getTime() } : {}),
        })),
      });
    } catch (error) {
      logger.error("Failed to re-sync user analysis", error, { owner: owner });
      setResyncError(
        error instanceof Error ? error.message : "Failed to re-sync. Please try again."
      );
    } finally {
      // The button stays in loading state until syncing actually starts
      // (the reactive query will show syncing status)
      setTimeout(() => setIsResyncing(false), 1000);
    }
  }, [owner, githubRepos]);

  // Phase 3: Reactive queries for sync progress + chart data
  const repoFullNames = useMemo(() => githubRepos.map((r) => r.full_name), [githubRepos]);

  const convexRepos = useQuery(
    api.queries.repos.getReposByFullNames,
    repoFullNames.length > 0 ? { fullNames: repoFullNames } : "skip"
  );

  const autoAnalyzePlan = useMemo(() => {
    if (githubRepos.length === 0 || !convexRepos) return null;

    return createUserAutoAnalyzePlan({
      owner,
      githubRepos: githubRepos.map((repo) => ({
        name: repo.name,
        fullName: repo.full_name,
        ...(repo.pushed_at ? { pushedAt: new Date(repo.pushed_at).getTime() } : {}),
      })),
      convexRepos,
    });
  }, [owner, githubRepos, convexRepos]);

  useEffect(() => {
    if (!autoAnalyzePlan || hasTriggered) return;
    setHasTriggered(true);

    if (!autoAnalyzePlan.shouldTrigger) return;

    const reposToAnalyze =
      autoAnalyzePlan.reposToAnalyze.length > 0
        ? autoAnalyzePlan.reposToAnalyze
        : githubRepos[0]
          ? [
              {
                owner,
                name: githubRepos[0].name,
                ...(githubRepos[0].pushed_at
                  ? { pushedAt: new Date(githubRepos[0].pushed_at).getTime() }
                  : {}),
              },
            ]
          : [];

    if (reposToAnalyze.length === 0) return;

    if (autoAnalyzePlan.showBootstrapIndicator) {
      setIsFirstIngestion(true);
    }

    void postJson("/api/analyze/user", { repos: reposToAnalyze })
      .then(() => {
        if (autoAnalyzePlan.showBootstrapIndicator) {
          // Keep "initializing" briefly to avoid flicker before reactive data updates.
          setTimeout(() => setIsFirstIngestion(false), 3000);
        }
      })
      .catch((error) => {
        logger.error("Failed to queue user analysis", error, { owner: owner });
        setIsFirstIngestion(false);
      });
  }, [autoAnalyzePlan, githubRepos, hasTriggered, owner]);

  const multiStats = useQuery(
    api.queries.stats.getMultiRepoWeeklyStats,
    repoFullNames.length > 0 ? { repoFullNames } : "skip"
  );

  const multiDailyStats = useQuery(
    api.queries.stats.getMultiRepoDailyStats,
    repoFullNames.length > 0 ? { repoFullNames } : "skip"
  );

  const multiRepoDetailedBreakdown = useQuery(
    api.queries.stats.getMultiRepoDetailedBreakdown,
    repoFullNames.length > 0 ? { repoFullNames } : "skip"
  );

  const dailyData = multiDailyStats ?? [];

  const aggregated = useMemo(
    () => (multiStats ? aggregateMultiRepoStats(multiStats) : []),
    [multiStats]
  );

  const userSummary = useMemo(
    () => (aggregated.length > 0 ? computeUserSummary(aggregated) : null),
    [aggregated]
  );

  const repoPercentagesById = useMemo(() => {
    if (!multiStats)
      return new Map<
        string,
        {
          humanPercentage: string;
          aiPercentage: string;
          automationPercentage: string;
          automationTools: string[];
        }
      >();

    const totalsByRepo = new Map<
      string,
      {
        human: number;
        ai: number;
        automation: number;
        total: number;
        dependabot: number;
        renovate: number;
        githubActions: number;
        otherBot: number;
      }
    >();
    for (const stat of multiStats) {
      const existing = totalsByRepo.get(stat.repoId) ?? {
        human: 0,
        ai: 0,
        automation: 0,
        total: 0,
        dependabot: 0,
        renovate: 0,
        githubActions: 0,
        otherBot: 0,
      };

      // 3-way split: human / AI tools / automation bots
      const aiCommits =
        stat.aiAssisted +
        stat.copilot +
        stat.claude +
        (stat.cursor ?? 0) +
        (stat.aider ?? 0) +
        (stat.devin ?? 0) +
        (stat.openaiCodex ?? 0) +
        (stat.gemini ?? 0);
      const automationCommits =
        stat.dependabot + stat.renovate + stat.githubActions + stat.otherBot;

      existing.human += stat.human;
      existing.ai += aiCommits;
      existing.automation += automationCommits;
      existing.total += stat.human + aiCommits + automationCommits;
      existing.dependabot += stat.dependabot;
      existing.renovate += stat.renovate;
      existing.githubActions += stat.githubActions;
      existing.otherBot += stat.otherBot;

      totalsByRepo.set(stat.repoId, existing);
    }

    const percentagesByRepo = new Map<
      string,
      {
        humanPercentage: string;
        aiPercentage: string;
        automationPercentage: string;
        automationTools: string[];
      }
    >();
    for (const [repoId, totals] of totalsByRepo) {
      const humanPercentage =
        totals.total > 0 ? formatPercentage((totals.human / totals.total) * 100) : "0";
      const aiPercentage =
        totals.total > 0 ? formatPercentage((totals.ai / totals.total) * 100) : "0";
      const automationPercentage =
        totals.total > 0 ? formatPercentage((totals.automation / totals.total) * 100) : "0";

      // Build list of active automation tools
      const automationTools: string[] = [];
      if (totals.dependabot > 0) automationTools.push("Dependabot");
      if (totals.renovate > 0) automationTools.push("Renovate");
      if (totals.githubActions > 0) automationTools.push("GitHub Actions");
      if (totals.otherBot > 0) automationTools.push("Other bots");

      percentagesByRepo.set(repoId, {
        humanPercentage,
        aiPercentage,
        automationPercentage,
        automationTools,
      });
    }

    return percentagesByRepo;
  }, [multiStats]);

  // Sync progress — split into "actively syncing" vs "queued"
  const activeCount = useMemo(() => {
    if (!convexRepos) return 0;
    return convexRepos.filter((r) => r.repo?.syncStatus === "syncing").length;
  }, [convexRepos]);

  const pendingCount = useMemo(() => {
    if (!convexRepos) return 0;
    return convexRepos.filter((r) => r.repo?.syncStatus === "pending").length;
  }, [convexRepos]);

  const syncedCount = useMemo(() => {
    if (!convexRepos) return 0;
    return convexRepos.filter((r) => r.repo?.syncStatus === "synced").length;
  }, [convexRepos]);

  const relatedUsers = useQuery(api.queries.users.getRelatedRecentUsers, {
    owner,
    limit: 6,
  });

  const isAnySyncing = useMemo(() => {
    if (!convexRepos) return false;
    return activeCount > 0 || pendingCount > 0;
  }, [activeCount, pendingCount, convexRepos]);

  // Find the currently syncing repo for detailed progress display
  const currentlySyncing = useMemo(() => {
    if (!convexRepos) return null;
    const syncingRepo = convexRepos.find((r) => r.repo?.syncStatus === "syncing");
    if (!syncingRepo?.repo) return null;
    return {
      name: syncingRepo.repo.name,
      syncStage: syncingRepo.repo.syncStage as string | undefined,
      syncCommitsFetched: syncingRepo.repo.syncCommitsFetched as number | undefined,
    };
  }, [convexRepos]);

  const totalRepoCount = convexRepos?.length ?? 0;

  const isSyncInProgress = (githubRepos.length > 0 && isAnySyncing) || isFirstIngestion;

  // Notification logic
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [wantsNotification, setWantsNotification] = useState(false);
  const prevSyncingRef = useRef(isSyncInProgress);
  const { playSuccess } = useSound();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSyncInProgress) {
      timer = setTimeout(() => {
        setShowNotificationPrompt(true);
      }, 20000); // 20 seconds
    } else {
      setShowNotificationPrompt(false);
    }
    return () => clearTimeout(timer);
  }, [isSyncInProgress]);

  useEffect(() => {
    if (prevSyncingRef.current && !isSyncInProgress && wantsNotification) {
      if (Notification.permission === "granted") {
        new Notification("Analysis Ready! 🚀", {
          body: `@${owner}'s contribution breakdown is now available.`,
          icon: "/icon.png",
        });
        playSuccess();
      }
      setWantsNotification(false);
    }
    prevSyncingRef.current = isSyncInProgress;
  }, [isSyncInProgress, wantsNotification, owner, playSuccess]);

  const funMessage = useFunSyncMessage(isSyncInProgress);

  const repoGroups = useMemo(() => {
    if (!githubRepos || githubRepos.length === 0) return [];

    if (sortMode === "stars") {
      const starBuckets: Record<string, GitHubRepo[]> = {
        "1000+": [],
        "100+": [],
        "10+": [],
        "1+": [],
        none: [],
      };

      for (const repo of githubRepos) {
        const stars = repo.stargazers_count;
        if (stars >= 1000) starBuckets["1000+"].push(repo);
        else if (stars >= 100) starBuckets["100+"].push(repo);
        else if (stars >= 10) starBuckets["10+"].push(repo);
        else if (stars >= 1) starBuckets["1+"].push(repo);
        else starBuckets.none.push(repo);
      }

      const sortByStars = (repos: GitHubRepo[]) =>
        repos.sort((a, b) => b.stargazers_count - a.stargazers_count);

      const starGroupOrder = [
        { key: "1000+", label: "1,000+ Stars" },
        { key: "100+", label: "100+ Stars" },
        { key: "10+", label: "10+ Stars" },
        { key: "1+", label: "1+ Stars" },
        { key: "none", label: "No Stars" },
      ];

      return starGroupOrder
        .filter(({ key }) => starBuckets[key].length > 0)
        .map(({ key, label }) => ({ label, repos: sortByStars(starBuckets[key]) }));
    }

    // "latest": group by time period based on pushed_at
    const now = Date.now();
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const threeMonths = 3 * oneMonth;
    const sixMonths = 6 * oneMonth;
    const oneYear = 365 * 24 * 60 * 60 * 1000;

    const buckets: Record<string, GitHubRepo[]> = {
      thisMonth: [],
      last3Months: [],
      last6Months: [],
      thisYear: [],
      older: [],
    };

    for (const repo of githubRepos) {
      const pushedAt = repo.pushed_at ? new Date(repo.pushed_at).getTime() : 0;
      const age = now - pushedAt;

      if (age <= oneMonth) buckets.thisMonth.push(repo);
      else if (age <= threeMonths) buckets.last3Months.push(repo);
      else if (age <= sixMonths) buckets.last6Months.push(repo);
      else if (age <= oneYear) buckets.thisYear.push(repo);
      else buckets.older.push(repo);
    }

    const sortByPushed = (repos: GitHubRepo[]) =>
      repos.sort((a, b) => {
        const timeA = a.pushed_at ? new Date(a.pushed_at).getTime() : 0;
        const timeB = b.pushed_at ? new Date(b.pushed_at).getTime() : 0;
        return timeB - timeA;
      });

    const groupOrder = [
      { key: "thisMonth", label: "This Month" },
      { key: "last3Months", label: "Last 3 Months" },
      { key: "last6Months", label: "Last 6 Months" },
      { key: "thisYear", label: "This Year" },
      { key: "older", label: "Older" },
    ];

    return groupOrder
      .filter(({ key }) => buckets[key].length > 0)
      .map(({ key, label }) => ({ label, repos: sortByPushed(buckets[key]) }));
  }, [githubRepos, sortMode]);

  // Flat sorted list used only for the "has any repos" check
  const hasRepos = githubRepos.length > 0;

  // Loading state
  if (githubLoading) {
    return <OwnerPageSkeleton />;
  }

  // Error state
  if (githubError) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-neutral-500">{githubError}</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Go back and try again
        </Link>
      </div>
    );
  }

  if (githubRepos.length === 0) {
    return (
      <div className="py-8">
        <Breadcrumbs items={ownerBreadcrumbs} />
        <div className="mt-16 text-center text-neutral-500">
          <h1 className="text-2xl font-bold">{owner}</h1>
          <p className="mt-2">No public repositories found for this user.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12">
      {/* User Header - Minimal & Focused */}
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <Image
            src={githubAvatarUrl || `https://github.com/${owner}.png?size=160`}
            alt={owner}
            width={128}
            height={128}
            className="h-24 w-24 rounded-full border-4 border-neutral-900 shadow-2xl sm:h-32 sm:w-32"
          />
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {githubDisplayName ? (
            githubDisplayName
          ) : (
            <a
              href={`https://github.com/${owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              @{owner}
            </a>
          )}
        </h1>
        {githubDisplayName && (
          <a
            href={`https://github.com/${owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-neutral-500 text-sm font-medium uppercase tracking-widest hover:text-neutral-300 transition-colors"
          >
            @{owner}
          </a>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
          <ErrorBoundary level="widget">
            <ShareButtons
              label={owner}
              type="user"
              botPercentage={userSummary?.aiPercentage ?? "0"}
            />
          </ErrorBoundary>
          <button
            type="button"
            onClick={handleResync}
            disabled={isResyncing || isSyncInProgress}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold transition-all hover:bg-neutral-800 active:scale-95 disabled:opacity-50 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncInProgress ? "animate-spin" : ""}`} />
            Re-sync
          </button>
        </div>
      </div>

      {resyncError && (
        <div className="mx-auto mt-8 max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {resyncError}
        </div>
      )}

      {/* Sync Progress Status Pill */}
      {isSyncInProgress && (
        <div className="mt-12 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400/80">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>
              {isAnySyncing
                ? `Synced ${syncedCount}/${totalRepoCount} repos`
                : "Initializing analysis"}
            </span>
            {currentlySyncing && (
              <span className="font-medium text-purple-400/50">
                — {currentlySyncing.name}:{" "}
                {getSyncStageLabel(currentlySyncing.syncStage, currentlySyncing.syncCommitsFetched)}
              </span>
            )}
          </div>
          <div className="text-sm italic text-neutral-500 transition-opacity duration-500">
            {funMessage}
          </div>

          {showNotificationPrompt && !wantsNotification && (
            <button
              type="button"
              onClick={() => setIsNotificationModalOpen(true)}
              className="mt-4 flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-all hover:bg-neutral-800 hover:text-white"
            >
              <Bell className="h-3 w-3 animate-bell-ring" />
              Taking a while? Notify me when done
            </button>
          )}

          {wantsNotification && (
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-green-500/80">
              <Bell className="h-3 w-3 animate-pulse" />
              We&apos;ll notify you once finished
            </div>
          )}
        </div>
      )}

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onConfirm={() => setWantsNotification(true)}
      />

      {/* Main Insights Card */}
      <div
        id="user-insights"
        className={`${isSyncInProgress ? "mt-6" : "mt-12"} relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/20 p-6 sm:p-10`}
      >
        {/* Core Stats */}
        {userSummary ? (
          <div className="space-y-12">
            <ErrorBoundary level="section">
              <StatsSummary
                totalCommits={userSummary.totals.total}
                botPercentage={userSummary.aiPercentage}
                humanPercentage={userSummary.humanPercentage}
                automationPercentage={userSummary.automationPercentage}
                trend={userSummary.trend}
                repoCount={syncedCount}
                locBotPercentage={userSummary.locBotPercentage}
                locHumanPercentage={userSummary.locHumanPercentage}
                locAutomationPercentage={userSummary.locAutomationPercentage}
                totalAdditions={userSummary.locTotals?.totalAdditions}
                hasLocData={userSummary.hasLocData}
                showZeroAiWhyCta={true}
              />
            </ErrorBoundary>

            {/* Heatmap */}
            <div className="space-y-6">
              <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Public Activity Timeline</h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Top 20 public repos you own. Commits by default, UTC.
                  </p>
                </div>
                {userSummary?.hasLocData && (
                  <div className="inline-flex self-start rounded-lg border border-neutral-800 bg-black p-1">
                    <button
                      type="button"
                      onClick={() => setChartMode("commits")}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        chartMode === "commits" ? "bg-white text-black" : "text-neutral-500"
                      }`}
                    >
                      Commits
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMode("loc")}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        chartMode === "loc" ? "bg-white text-black" : "text-neutral-500"
                      }`}
                    >
                      Code Volume
                    </button>
                  </div>
                )}
              </div>
              <ErrorBoundary level="widget">
                <div className="rounded-xl border border-neutral-800/50 bg-black/20 p-4">
                  <ContributionHeatmap
                    data={dailyData}
                    viewMode={userSummary?.hasLocData ? chartMode : "commits"}
                    isSyncing={isSyncInProgress}
                  />
                </div>
              </ErrorBoundary>
            </div>

            {/* AI Tool Breakdown */}
            {multiRepoDetailedBreakdown && multiRepoDetailedBreakdown.toolBreakdown.length > 0 && (
              <ErrorBoundary level="section">
                <AIToolBreakdown
                  toolBreakdown={multiRepoDetailedBreakdown.toolBreakdown}
                  viewMode={userSummary.hasLocData ? chartMode : "commits"}
                />
              </ErrorBoundary>
            )}

            {/* Automation Bot Breakdown */}
            {multiRepoDetailedBreakdown && multiRepoDetailedBreakdown.botBreakdown.length > 0 && (
              <ErrorBoundary level="section">
                <BotToolBreakdown botBreakdown={multiRepoDetailedBreakdown.botBreakdown} />
              </ErrorBoundary>
            )}
          </div>
        ) : isSyncInProgress ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-neutral-800 bg-neutral-900/40"
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-neutral-500 font-medium">
            No analysis data available.
          </div>
        )}
      </div>

      {/* Source Repositories */}
      {hasRepos && (
        <div className="mt-20">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-xl font-bold text-white whitespace-nowrap">
                Source Repositories
              </h2>
              <div className="h-px w-full bg-neutral-800 hidden sm:block" />
            </div>

            <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1">
              <button
                type="button"
                onClick={() => setSortMode("latest")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  sortMode === "latest" ? "bg-white text-black" : "text-neutral-500"
                }`}
              >
                Latest
              </button>
              <button
                type="button"
                onClick={() => setSortMode("stars")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  sortMode === "stars" ? "bg-white text-black" : "text-neutral-500"
                }`}
              >
                Stars
              </button>
            </div>
          </div>

          <ErrorBoundary level="section">
            <div className="space-y-10">
              {repoGroups.map((group) => (
                <div key={group.label}>
                  <div className="mb-4 flex items-center gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">
                      {group.label}
                    </h3>
                    <span className="text-xs text-neutral-600">{group.repos.length}</span>
                    <div className="h-px flex-1 bg-neutral-800/50" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.repos.map((ghRepo) => {
                      const convexRepo = convexRepos?.find((r) => r.fullName === ghRepo.full_name);
                      const syncStatus = convexRepo?.repo?.syncStatus;
                      const repoPercentages = convexRepo?.repo?._id
                        ? repoPercentagesById.get(convexRepo.repo._id)
                        : undefined;
                      const repoHref = `/${encodeURIComponent(owner)}/${encodeURIComponent(
                        ghRepo.name
                      )}`;

                      return (
                        <Link
                          key={ghRepo.id}
                          href={repoHref}
                          className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 transition-all hover:border-neutral-700 hover:bg-neutral-900"
                        >
                          <div>
                            <div className="flex min-h-[20px] items-center justify-between gap-4">
                              <div className="truncate font-bold text-neutral-200 group-hover:text-white">
                                {ghRepo.name}
                              </div>
                              <SyncBadge
                                status={syncStatus}
                                syncStage={convexRepo?.repo?.syncStage as string | undefined}
                                syncCommitsFetched={
                                  convexRepo?.repo?.syncCommitsFetched as number | undefined
                                }
                              />
                            </div>
                            {ghRepo.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                                {ghRepo.description}
                              </p>
                            )}
                            <div className="mt-3 min-h-[22px]">
                              {repoPercentages && (
                                <HumanAiBadges
                                  humanPercentage={repoPercentages.humanPercentage}
                                  aiPercentage={repoPercentages.aiPercentage}
                                  automationPercentage={repoPercentages.automationPercentage}
                                  automationTools={repoPercentages.automationTools}
                                />
                              )}
                            </div>
                          </div>

                          <div className="mt-4 flex h-4 items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                            {ghRepo.stargazers_count > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {ghRepo.stargazers_count.toLocaleString()}
                              </span>
                            )}
                            {ghRepo.language && <span>{ghRepo.language}</span>}
                            {convexRepo?.repo?.totalCommitsFetched != null && (
                              <span>
                                {convexRepo.repo.totalCommitsFetched.toLocaleString()} commits
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ErrorBoundary>
        </div>
      )}

      {/* Related Recent Generations */}
      {relatedUsers && relatedUsers.length > 0 && (
        <div className="mt-24 pt-12 border-t border-neutral-800/50">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold tracking-tight text-white">Recent Generations</h2>
              <div className="h-px w-24 bg-neutral-800 hidden sm:block" />
              <p className="text-xs text-neutral-500 font-medium">
                Other users analyzed around the same time
              </p>
            </div>
          </div>

          <ErrorBoundary level="section">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedUsers.map((user) => (
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
              ))}
            </div>
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

function SyncBadge({
  status,
  syncStage,
  syncCommitsFetched,
}: {
  status?: string;
  syncStage?: string;
  syncCommitsFetched?: number;
}) {
  if (!status || status === "pending") {
    return (
      <span className="flex items-center gap-1 text-xs text-neutral-400">
        <Clock className="h-3 w-3" />
        Queued
      </span>
    );
  }
  if (status === "syncing") {
    return (
      <span className="flex items-center gap-1 text-xs text-purple-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        {getSyncBadgeLabel(syncStage, syncCommitsFetched)}
      </span>
    );
  }
  if (status === "synced") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Synced
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-red-500">
        <XCircle className="h-3 w-3" />
        Error
      </span>
    );
  }
  return null;
}
