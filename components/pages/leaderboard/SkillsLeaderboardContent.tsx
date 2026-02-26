"use client";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FileCode, Link as LinkIcon, Wand2 } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/tracking";
import { formatCompactNumber } from "./utils";

type GlobalSkillsData = FunctionReturnType<typeof api.queries.stats.getGlobalSkillsLeaderboard>;
type SkillRow = GlobalSkillsData[number];

const sortModes = ["repos", "stars"] as const;

const columns: ColumnDef<SkillRow>[] = [
  {
    id: "name",
    accessorFn: (row) => row.name,
    enableSorting: false,
  },
  {
    id: "tool",
    accessorFn: (row) => row.tool,
    enableSorting: false,
  },
  {
    id: "repoCount",
    accessorFn: (row) => row.repoCount,
    sortDescFirst: true,
  },
  {
    id: "totalStars",
    accessorFn: (row) => row.totalStars,
    sortDescFirst: true,
  },
];

function modeToSorting(mode: (typeof sortModes)[number]): SortingState {
  switch (mode) {
    case "stars":
      return [{ id: "totalStars", desc: true }];
    default:
      return [{ id: "repoCount", desc: true }];
  }
}

function sortingToMode(sorting: SortingState): (typeof sortModes)[number] {
  const column = sorting[0]?.id;
  if (column === "totalStars") return "stars";
  return "repos";
}

function sortIndicator(sorting: false | "asc" | "desc") {
  if (sorting === "asc") return "↑";
  if (sorting === "desc") return "↓";
  return "";
}

export function SkillsLeaderboardContent({ initialData }: { initialData: GlobalSkillsData }) {
  const data = useQuery(api.queries.stats.getGlobalSkillsLeaderboard) ?? initialData;

  const [sortMode, setSortMode] = useQueryState(
    "sort",
    parseAsStringLiteral(sortModes).withDefault("repos").withOptions({ scroll: false })
  );
  const hasTrackedInitialSort = useRef(false);
  const [sorting, setSorting] = useState<SortingState>(() => modeToSorting(sortMode));

  useEffect(() => {
    if (!hasTrackedInitialSort.current) {
      hasTrackedInitialSort.current = true;
      return;
    }
    trackEvent("leaderboard_sort_change", { section: "skills", sort: sortMode });
  }, [sortMode]);

  useEffect(() => {
    setSorting(modeToSorting(sortMode));
  }, [sortMode]);

  const table = useReactTable({
    data,
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
      repoCount: table.getColumn("repoCount"),
      totalStars: table.getColumn("totalStars"),
    }),
    [table]
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Agent Skills & Configs</h2>
          <p className="text-sm text-neutral-400">
            Discovered from repository configurations (like .cursorrules) and agent skill folders.
          </p>
        </div>
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
              <th className="px-4 py-3">Config / Skill</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => sortColumns.repoCount?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Repos {sortIndicator(sortColumns.repoCount?.getIsSorted() ?? false)}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => sortColumns.totalStars?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Est. Reach (Stars) {sortIndicator(sortColumns.totalStars?.getIsSorted() ?? false)}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const skill = row.original;
              const isSkill = skill.tool === "skills.sh" || skill.type === "Skill";
              const skillUrl = isSkill
                ? `https://skills.sh/?q=${encodeURIComponent(skill.name)}`
                : null;

              return (
                <tr
                  key={`${skill.tool}-${skill.name}`}
                  className="border-t border-neutral-800/80 hover:bg-neutral-900/40 transition-colors"
                >
                  <td className="px-4 py-4 font-semibold text-neutral-400">{index + 1}</td>
                  <td className="px-4 py-4">
                    {skillUrl ? (
                      <a
                        href={skillUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-2 font-semibold text-purple-400 hover:text-purple-300"
                      >
                        <Wand2 className="h-4 w-4" />
                        {skill.name}
                        <LinkIcon className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    ) : (
                      <div className="inline-flex items-center gap-2 font-semibold text-blue-400">
                        <FileCode className="h-4 w-4" />
                        {skill.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-neutral-300">
                    <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs font-medium text-neutral-300">
                      {skill.tool}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-white">
                    {formatCompactNumber(skill.repoCount)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-amber-400">
                    {formatCompactNumber(skill.totalStars)}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                  No AI tools or skills have been detected yet. Analyze repositories with
                  .cursorrules or skills.sh to see them here!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
