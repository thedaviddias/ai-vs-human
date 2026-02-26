"use client";

import { cn } from "@/lib/utils";

const STAT_CARD_KEYS = ["total", "human", "ai", "trend"] as const;
const OWNER_REPO_CARD_KEYS = ["repo-1", "repo-2", "repo-3", "repo-4", "repo-5", "repo-6"] as const;

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-neutral-800", className)} />;
}

function SurfaceSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/40",
        className
      )}
    />
  );
}

function StatsSummarySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {STAT_CARD_KEYS.map((key) => (
        <SurfaceSkeleton key={key} className="h-32" />
      ))}
    </div>
  );
}

export function OwnerPageSkeleton() {
  return (
    <div className="py-12">
      {/* User Header Skeleton */}
      <div className="flex flex-col items-center text-center">
        <div className="h-24 w-24 animate-pulse rounded-full bg-neutral-800 border-4 border-neutral-900 shadow-2xl sm:h-32 sm:w-32" />
        <Skeleton className="mt-6 h-10 w-48 max-w-full" />
        <Skeleton className="mt-2 h-4 w-32 max-w-full opacity-50" />

        <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
          {/* Copy Card */}
          <SurfaceSkeleton className="h-9 w-[100px] rounded-xl bg-white/20 sm:h-10 sm:w-[120px]" />
          {/* Post on X */}
          <SurfaceSkeleton className="h-9 w-[95px] rounded-xl bg-black sm:h-10 sm:w-[110px]" />
          {/* Copy Link */}
          <SurfaceSkeleton className="h-9 w-[95px] rounded-xl sm:h-10 sm:w-[110px]" />
          {/* More (...) */}
          <SurfaceSkeleton className="h-9 w-9 rounded-xl sm:h-10 sm:w-10" />
          {/* Re-sync */}
          <SurfaceSkeleton className="h-9 w-[85px] rounded-xl sm:h-10 sm:w-[95px]" />
        </div>
      </div>

      {/* Main Insights Card Skeleton */}
      <div className="mt-12 relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/20 p-6 sm:p-10">
        <div className="space-y-12">
          <StatsSummarySkeleton />

          <div className="space-y-6">
            <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-40" />
                </div>
                <Skeleton className="mt-2 h-3 w-64 opacity-50" />
              </div>
              <SurfaceSkeleton className="h-8 w-40 rounded-lg sm:self-start" />
            </div>
            <SurfaceSkeleton className="h-[400px] w-full rounded-xl border-neutral-800/50 bg-black/20" />
          </div>
        </div>
      </div>

      <div className="mt-20">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 flex-1">
            <Skeleton className="h-7 w-48" />
            <div className="h-px w-full bg-neutral-800 hidden sm:block" />
          </div>

          <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1 gap-1">
            <SurfaceSkeleton className="h-7 w-16 rounded-md" />
            <SurfaceSkeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>

        <div className="space-y-10">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-6 rounded-full" />
              <div className="h-px flex-1 bg-neutral-800/50" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {OWNER_REPO_CARD_KEYS.map((key) => (
                <SurfaceSkeleton key={key} className="h-36" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RepoPageSkeleton() {
  return (
    <div className="py-8">
      <Skeleton className="h-4 w-64 max-w-full mb-4 opacity-50" />

      <div className="mt-4 space-y-2">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full opacity-50" />
      </div>

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <StatsSummarySkeleton />

        <div className="mt-8 border-b border-neutral-800">
          <div className="flex gap-6 pb-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        <SurfaceSkeleton className="mt-6 h-[432px] w-full border-neutral-800/50 bg-black/20" />
      </div>
    </div>
  );
}
