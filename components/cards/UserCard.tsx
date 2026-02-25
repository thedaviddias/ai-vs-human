"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HumanAiBadges } from "@/components/badges/HumanAiBadges";
import { logger } from "@/lib/logger";

interface UserCardProps {
  owner: string;
  avatarUrl: string;
  displayName?: string;
  followers?: number;
  humanPercentage: string;
  botPercentage: string;
  totalCommits: number;
  repoCount: number;
  lastIndexedAt?: number;
  isSyncing?: boolean;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval}y ago`;
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval}mo ago`;
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval}d ago`;
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval}h ago`;
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval}m ago`;
  return "just now";
}

export function UserCard({
  owner,
  avatarUrl,
  displayName: initialDisplayName,
  followers: initialFollowers,
  humanPercentage,
  botPercentage,
  totalCommits,
  repoCount,
  lastIndexedAt,
  isSyncing = false,
}: UserCardProps) {
  const [showFallbackAvatar, setShowFallbackAvatar] = useState(false);
  const [localProfile, setLocalProfile] = useState<{
    name: string | null;
    followers: number;
  } | null>(null);

  const ownerInitial = useMemo(() => owner.charAt(0).toUpperCase() || "?", [owner]);

  // Fetch from GitHub if we don't have the data from Convex yet
  useEffect(() => {
    // If we have both name and followers from Convex, no need to fetch
    if (initialDisplayName !== undefined && initialFollowers !== undefined) return;

    const fetchProfile = async () => {
      try {
        logger.info("[UserCard] Fallback fetch", { owner });
        const res = await fetch(`https://api.github.com/users/${owner}`);
        if (res.ok) {
          const data = await res.json();
          setLocalProfile({
            name: data.name ?? null,
            followers: data.followers ?? 0,
          });
        } else {
          logger.warn("[UserCard] GitHub API error", { owner, status: res.status });
        }
      } catch (e) {
        logger.error("[UserCard] Failed to fetch fallback profile", e, { owner });
      }
    };

    fetchProfile();
  }, [owner, initialDisplayName, initialFollowers]);

  const displayName = initialDisplayName ?? localProfile?.name;
  const followers = initialFollowers ?? localProfile?.followers;

  return (
    <Link
      href={`/${owner}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 transition-all hover:border-neutral-700 hover:bg-neutral-900/60"
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              {showFallbackAvatar ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800 text-lg font-bold text-neutral-400 border border-neutral-700">
                  {ownerInitial}
                </div>
              ) : (
                <Image
                  src={avatarUrl}
                  alt={`${owner} avatar`}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full border border-neutral-700 object-cover shadow-sm transition-transform group-hover:scale-105"
                  onError={() => setShowFallbackAvatar(true)}
                />
              )}
              <div
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-neutral-900 ${
                  isSyncing ? "bg-purple-500 animate-pulse" : "bg-green-500"
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold tracking-tight text-white group-hover:text-green-400">
                {displayName ?? `@${owner}`}
              </div>
              {displayName && (
                <div className="truncate text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  @{owner}
                </div>
              )}
            </div>
          </div>
          {lastIndexedAt && (
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-700">
              {formatTimeAgo(lastIndexedAt)}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-y-2 gap-x-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
              Followers
            </span>
            <span className="text-sm font-bold text-neutral-200">
              {typeof followers === "number" ? formatCompactNumber(followers) : "—"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
              Commits
            </span>
            <span className="text-sm font-bold text-neutral-200">
              {formatCompactNumber(totalCommits)}
              {isSyncing && "+"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
              Repos
            </span>
            <span className="text-sm font-bold text-neutral-200">
              {formatCompactNumber(repoCount)}
              {isSyncing && "+"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-neutral-800/50 pt-4">
        {isSyncing ? (
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400/80">
              Analyzing Contributions...
            </span>
          </div>
        ) : (
          <HumanAiBadges
            humanPercentage={humanPercentage}
            aiPercentage={botPercentage}
            aiLabel="AI"
          />
        )}
      </div>
    </Link>
  );
}
