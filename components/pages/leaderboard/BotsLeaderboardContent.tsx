"use client";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { BotLogo } from "./toolVisuals";
import { formatCompactNumber } from "./utils";

interface BotEntry {
  key: string;
  label: string;
  commits: number;
  repoCount: number;
  ownerCount: number;
}

interface ToolLeaderboardsData {
  aiTools: Array<{
    key: string;
    label: string;
    commits: number;
    additions: number;
    repoCount: number;
    ownerCount: number;
  }>;
  bots: BotEntry[];
}

const columns: ColumnDef<BotEntry>[] = [
  {
    id: "label",
    accessorFn: (row) => row.label,
    enableSorting: false,
  },
  {
    id: "commits",
    accessorFn: (row) => row.commits,
    sortDescFirst: true,
  },
  {
    id: "repoCount",
    accessorFn: (row) => row.repoCount,
    sortDescFirst: true,
  },
  {
    id: "ownerCount",
    accessorFn: (row) => row.ownerCount,
    sortDescFirst: true,
  },
];

function sortIndicator(sorting: false | "asc" | "desc") {
  if (sorting === "asc") return "↑";
  if (sorting === "desc") return "↓";
  return "";
}

export function BotsLeaderboardContent({ initialData }: { initialData: ToolLeaderboardsData }) {
  const data = useQuery(api.queries.stats.getGlobalToolLeaderboards) ?? initialData;
  const [sorting, setSorting] = useState<SortingState>([{ id: "commits", desc: true }]);

  const table = useReactTable({
    data: data.bots,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const sortColumns = useMemo(
    () => ({
      commits: table.getColumn("commits"),
      repos: table.getColumn("repoCount"),
      owners: table.getColumn("ownerCount"),
    }),
    [table]
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Automation Bots</h2>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/70 text-left text-xs uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Bot</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => sortColumns.commits?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Commits {sortIndicator(sortColumns.commits?.getIsSorted() ?? false)}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => sortColumns.repos?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Repos {sortIndicator(sortColumns.repos?.getIsSorted() ?? false)}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => sortColumns.owners?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Owners {sortIndicator(sortColumns.owners?.getIsSorted() ?? false)}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const bot = row.original;
              return (
                <tr
                  key={bot.key}
                  className="border-t border-neutral-800/80 hover:bg-neutral-900/40"
                >
                  <td className="px-4 py-3 font-semibold text-neutral-400">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <BotLogo botKey={bot.key} label={bot.label} />
                      <span className="font-semibold text-white">{bot.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-200">{formatCompactNumber(bot.commits)}</td>
                  <td className="px-4 py-3 text-neutral-300">
                    {formatCompactNumber(bot.repoCount)}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {formatCompactNumber(bot.ownerCount)}
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
