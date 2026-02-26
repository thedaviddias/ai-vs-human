"use client";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { useQuery } from "convex/react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/tracking";
import { formatCompactNumber, formatDateTime } from "./utils";

interface IndexedRepoData {
  owner: string;
  name: string;
  fullName: string;
  stars?: number;
  lastSyncedAt?: number;
  requestedAt: number;
  aiConfigs?: Array<{ tool: string; type: string; name: string }>;
}

const sortModes = ["stars", "latest", "owner"] as const;

const columns: ColumnDef<IndexedRepoData>[] = [
  {
    id: "fullName",
    accessorFn: (row) => row.fullName,
    enableSorting: false,
  },
  {
    id: "aiStack",
    accessorFn: (row) => row.aiConfigs,
    enableSorting: false,
  },
  {
    id: "stars",
    accessorFn: (row) => row.stars ?? 0,
    sortDescFirst: true,
  },
  {
    id: "owner",
    accessorFn: (row) => row.owner,
  },
  {
    id: "lastSyncedAt",
    accessorFn: (row) => row.lastSyncedAt ?? row.requestedAt,
    sortDescFirst: true,
  },
];

function modeToSorting(mode: (typeof sortModes)[number]): SortingState {
  switch (mode) {
    case "latest":
      return [{ id: "lastSyncedAt", desc: true }];
    case "owner":
      return [{ id: "owner", desc: false }];
    default:
      return [{ id: "stars", desc: true }];
  }
}

function sortingToMode(sorting: SortingState): (typeof sortModes)[number] {
  const column = sorting[0]?.id;
  if (column === "lastSyncedAt") return "latest";
  if (column === "owner") return "owner";
  return "stars";
}

function sortIndicator(sorting: false | "asc" | "desc") {
  if (sorting === "asc") return "↑";
  if (sorting === "desc") return "↓";
  return "";
}

export function ReposLeaderboardContent({ initialRepos }: { initialRepos: IndexedRepoData[] }) {
  const repos = useQuery(api.queries.repos.getIndexedRepos) ?? initialRepos;
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
    trackEvent("leaderboard_sort_change", { section: "repos", sort: sortMode });
  }, [sortMode]);

  useEffect(() => {
    setSorting(modeToSorting(sortMode));
  }, [sortMode]);

  const table = useReactTable({
    data: repos,
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
      stars: table.getColumn("stars"),
      owner: table.getColumn("owner"),
      latest: table.getColumn("lastSyncedAt"),
    }),
    [table]
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Repositories</h2>
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

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/70 text-left text-xs uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Repository</th>
              <th className="px-4 py-3">AI Stack</th>
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
                  onClick={() => sortColumns.owner?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Owner {sortIndicator(sortColumns.owner?.getIsSorted() ?? false)}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => sortColumns.latest?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Last Synced {sortIndicator(sortColumns.latest?.getIsSorted() ?? false)}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const repo = row.original;
              return (
                <tr
                  key={repo.fullName}
                  className="border-t border-neutral-800/80 hover:bg-neutral-900/40"
                >
                  <td className="px-4 py-3 font-semibold text-neutral-400">{index + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`}
                      className="font-semibold text-white hover:text-neutral-200"
                    >
                      {repo.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {repo.aiConfigs && repo.aiConfigs.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {repo.aiConfigs.slice(0, 3).map((config) => {
                          const isSkill = config.tool === "skills.sh" || config.type === "Skill";
                          const label = isSkill ? config.name : config.tool;
                          return (
                            <span
                              key={`${config.tool}-${config.name}`}
                              title={config.name}
                              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                isSkill
                                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              }`}
                            >
                              {label}
                            </span>
                          );
                        })}
                        {repo.aiConfigs.length > 3 && (
                          <span className="inline-flex items-center rounded-md bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400">
                            +{repo.aiConfigs.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-amber-300">
                    {formatCompactNumber(repo.stars ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">@{repo.owner}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {formatDateTime(repo.lastSyncedAt ?? repo.requestedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
