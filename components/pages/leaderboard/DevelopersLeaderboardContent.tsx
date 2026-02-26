"use client";

import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef } from "react";
import { HumanAiBadges } from "@/components/badges/HumanAiBadges";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/tracking";
import { formatCompactNumber, formatDateTime } from "./utils";

interface IndexedUserData {
  owner: string;
  avatarUrl: string;
  humanPercentage: string;
  botPercentage: string;
  automationPercentage: string;
  totalCommits: number;
  totalStars: number;
  repoCount: number;
  lastIndexedAt: number;
  isSyncing: boolean;
  profile?: {
    name?: string | null;
    followers?: number;
    avatarUrl?: string;
  };
}

const sortModes = ["stars", "commits", "followers", "latest"] as const;

function compareTiebreakers(a: IndexedUserData, b: IndexedUserData) {
  if (b.totalCommits !== a.totalCommits) return b.totalCommits - a.totalCommits;
  if (b.repoCount !== a.repoCount) return b.repoCount - a.repoCount;
  return a.owner.localeCompare(b.owner);
}

export function DevelopersLeaderboardContent({
  initialUsers,
}: {
  initialUsers: IndexedUserData[];
}) {
  const users = useQuery(api.queries.users.getIndexedUsersWithProfiles) ?? initialUsers;
  const [sortMode, setSortMode] = useQueryState(
    "sort",
    parseAsStringLiteral(sortModes).withDefault("stars")
  );
  const hasTrackedInitialSort = useRef(false);

  useEffect(() => {
    if (!hasTrackedInitialSort.current) {
      hasTrackedInitialSort.current = true;
      return;
    }
    trackEvent("leaderboard_sort_change", { section: "developers", sort: sortMode });
  }, [sortMode]);

  const sortedUsers = useMemo(() => {
    const base = [...users];

    return base.sort((a, b) => {
      switch (sortMode) {
        case "stars":
          return b.totalStars - a.totalStars || compareTiebreakers(a, b);
        case "commits":
          return b.totalCommits - a.totalCommits || compareTiebreakers(a, b);
        case "followers": {
          const followersA = a.profile?.followers ?? 0;
          const followersB = b.profile?.followers ?? 0;
          return followersB - followersA || compareTiebreakers(a, b);
        }
        case "latest":
          return b.lastIndexedAt - a.lastIndexedAt || compareTiebreakers(a, b);
        default:
          return compareTiebreakers(a, b);
      }
    });
  }, [users, sortMode]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Developers</h2>
        <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1">
          {sortModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                sortMode === mode ? "bg-white text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-neutral-800 lg:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/70 text-left text-xs uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Developer</th>
              <th className="px-4 py-3">Stars</th>
              <th className="px-4 py-3">Commits</th>
              <th className="px-4 py-3">Repos</th>
              <th className="px-4 py-3">Mix</th>
              <th className="px-4 py-3">Last Indexed</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user, index) => (
              <tr
                key={user.owner}
                className="border-t border-neutral-800/80 hover:bg-neutral-900/40"
              >
                <td className="px-4 py-3 font-semibold text-neutral-400">{index + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/${encodeURIComponent(user.owner)}`}
                    className="flex items-center gap-3 text-white hover:text-neutral-200"
                  >
                    <Image
                      src={user.profile?.avatarUrl ?? user.avatarUrl}
                      alt={`${user.owner} avatar`}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full border border-neutral-700"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {user.profile?.name ?? user.owner}
                      </div>
                      <div className="truncate text-xs text-neutral-500">@{user.owner}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 font-semibold text-amber-300">
                  {formatCompactNumber(user.totalStars)}
                </td>
                <td className="px-4 py-3 font-semibold text-neutral-200">
                  {formatCompactNumber(user.totalCommits)}
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {formatCompactNumber(user.repoCount)}
                </td>
                <td className="px-4 py-3">
                  <HumanAiBadges
                    humanPercentage={user.humanPercentage}
                    aiPercentage={user.botPercentage}
                    automationPercentage={user.automationPercentage}
                  />
                </td>
                <td className="px-4 py-3 text-neutral-400">{formatDateTime(user.lastIndexedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {sortedUsers.map((user, index) => (
          <Link
            key={user.owner}
            href={`/${encodeURIComponent(user.owner)}`}
            className="block rounded-xl border border-neutral-800 bg-neutral-900/30 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-neutral-500">#{index + 1}</div>
                <Image
                  src={user.profile?.avatarUrl ?? user.avatarUrl}
                  alt={`${user.owner} avatar`}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full border border-neutral-700"
                />
                <div>
                  <div className="font-semibold text-white">{user.profile?.name ?? user.owner}</div>
                  <div className="text-xs text-neutral-500">@{user.owner}</div>
                </div>
              </div>
              <div className="text-xs text-neutral-500">{formatDateTime(user.lastIndexedAt)}</div>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-300">
              <div>
                <span className="text-neutral-500">Stars</span>{" "}
                {formatCompactNumber(user.totalStars)}
              </div>
              <div>
                <span className="text-neutral-500">Commits</span>{" "}
                {formatCompactNumber(user.totalCommits)}
              </div>
              <div>
                <span className="text-neutral-500">Repos</span>{" "}
                {formatCompactNumber(user.repoCount)}
              </div>
            </div>
            <div className="mt-3">
              <HumanAiBadges
                humanPercentage={user.humanPercentage}
                aiPercentage={user.botPercentage}
                automationPercentage={user.automationPercentage}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
