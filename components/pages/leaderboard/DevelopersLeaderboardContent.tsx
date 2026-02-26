"use client";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { useQuery } from "convex/react";
import { Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { HumanAiBadges } from "@/components/badges/HumanAiBadges";
import { api } from "@/convex/_generated/api";
import { getPublicCommitCount, getPublicStarCount } from "@/lib/leaderboardSort";
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
  hasPrivateData?: boolean;
  publicTotalCommits?: number;
  publicTotalStars?: number;
  profile?: {
    name?: string | null;
    followers?: number;
    avatarUrl?: string;
  };
}

const sortModes = ["stars", "commits", "followers", "latest"] as const;

const columns: ColumnDef<IndexedUserData>[] = [
  {
    id: "owner",
    accessorFn: (row) => row.owner,
    enableSorting: false,
  },
  {
    id: "totalStars",
    accessorFn: (row) => getPublicStarCount(row),
    sortDescFirst: true,
  },
  {
    id: "totalCommits",
    accessorFn: (row) => getPublicCommitCount(row),
    sortDescFirst: true,
  },
  {
    id: "repoCount",
    accessorFn: (row) => row.repoCount,
    enableSorting: false,
  },
  {
    id: "mix",
    accessorFn: (row) => row.botPercentage,
    enableSorting: false,
  },
  {
    id: "followers",
    accessorFn: (row) => row.profile?.followers ?? 0,
    sortDescFirst: true,
  },
  {
    id: "lastIndexedAt",
    accessorFn: (row) => row.lastIndexedAt,
    sortDescFirst: true,
  },
];

function modeToSorting(mode: (typeof sortModes)[number]): SortingState {
  switch (mode) {
    case "commits":
      return [{ id: "totalCommits", desc: true }];
    case "followers":
      return [{ id: "followers", desc: true }];
    case "latest":
      return [{ id: "lastIndexedAt", desc: true }];
    default:
      return [{ id: "totalStars", desc: true }];
  }
}

function sortingToMode(sorting: SortingState): (typeof sortModes)[number] {
  const column = sorting[0]?.id;
  if (column === "totalCommits") return "commits";
  if (column === "followers") return "followers";
  if (column === "lastIndexedAt") return "latest";
  return "stars";
}

function sortIndicator(sorting: false | "asc" | "desc") {
  if (sorting === "asc") return "↑";
  if (sorting === "desc") return "↓";
  return "";
}

export function DevelopersLeaderboardContent({
  initialUsers,
}: {
  initialUsers: IndexedUserData[];
}) {
  const users = useQuery(api.queries.users.getIndexedUsersWithProfiles, {}) ?? initialUsers;
  const [sortMode, setSortMode] = useQueryState(
    "sort",
    parseAsStringLiteral(sortModes).withDefault("stars").withOptions({ scroll: false })
  );
  const hasTrackedInitialSort = useRef(false);
  const [sorting, setSorting] = useState<SortingState>(() => modeToSorting(sortMode));

  useEffect(() => {
    if (!hasTrackedInitialSort.current) {
      hasTrackedInitialSort.current = true;
      return;
    }
    trackEvent("leaderboard_sort_change", { section: "developers", sort: sortMode });
  }, [sortMode]);

  useEffect(() => {
    setSorting(modeToSorting(sortMode));
  }, [sortMode]);

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting((old) => {
        const next = typeof updater === "function" ? updater(old) : updater;
        const nextMode = sortingToMode(next);
        if (nextMode !== sortMode) {
          void setSortMode(nextMode);
        }
        return next;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const sortColumns = useMemo(
    () => ({
      stars: table.getColumn("totalStars"),
      commits: table.getColumn("totalCommits"),
      followers: table.getColumn("followers"),
      latest: table.getColumn("lastIndexedAt"),
    }),
    [table]
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Developers</h2>
        <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1">
          {sortModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                void setSortMode(mode);
                setSorting(modeToSorting(mode));
              }}
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
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => sortColumns.stars?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Stars {sortIndicator(sortColumns.stars?.getIsSorted() ?? false)}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => sortColumns.commits?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Commits {sortIndicator(sortColumns.commits?.getIsSorted() ?? false)}
                </button>
              </th>
              <th className="px-4 py-3">Repos</th>
              <th className="px-4 py-3">Mix</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => sortColumns.latest?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Last Indexed {sortIndicator(sortColumns.latest?.getIsSorted() ?? false)}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const user = row.original;
              return (
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
                    {user.hasPrivateData && (
                      <Lock
                        className="ml-1 inline h-3 w-3 text-purple-400/60"
                        aria-label="Includes private repo data"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {formatCompactNumber(user.repoCount)}
                    {user.hasPrivateData && "+"}
                  </td>
                  <td className="px-4 py-3">
                    <HumanAiBadges
                      humanPercentage={user.humanPercentage}
                      aiPercentage={user.botPercentage}
                      automationPercentage={user.automationPercentage}
                    />
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {formatDateTime(user.lastIndexedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((row, index) => {
          const user = row.original;
          return (
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
                    <div className="font-semibold text-white">
                      {user.profile?.name ?? user.owner}
                    </div>
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
                  {user.hasPrivateData && (
                    <Lock
                      className="ml-1 inline h-3 w-3 text-purple-400/60"
                      aria-label="Includes private repo data"
                    />
                  )}
                </div>
                <div>
                  <span className="text-neutral-500">Repos</span>{" "}
                  {formatCompactNumber(user.repoCount)}
                  {user.hasPrivateData && "+"}
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
          );
        })}
      </div>
    </div>
  );
}
