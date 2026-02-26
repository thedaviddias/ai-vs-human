"use client";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { useQuery } from "convex/react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/tracking";
import { AiToolLogo } from "./toolVisuals";
import { formatCompactNumber } from "./utils";

interface AiToolEntry {
  key: string;
  label: string;
  commits: number;
  additions: number;
  repoCount: number;
  ownerCount: number;
}

interface ToolLeaderboardsData {
  aiTools: AiToolEntry[];
  bots: Array<{
    key: string;
    label: string;
    commits: number;
    repoCount: number;
    ownerCount: number;
  }>;
}

const metrics = ["commits", "loc"] as const;

const columns: ColumnDef<AiToolEntry>[] = [
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
    id: "additions",
    accessorFn: (row) => row.additions,
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

function metricToSorting(metric: (typeof metrics)[number]): SortingState {
  if (metric === "loc") {
    return [{ id: "additions", desc: true }];
  }
  return [{ id: "commits", desc: true }];
}

function sortIndicator(sorting: false | "asc" | "desc") {
  if (sorting === "asc") return "↑";
  if (sorting === "desc") return "↓";
  return "";
}

export function AiToolsLeaderboardContent({ initialData }: { initialData: ToolLeaderboardsData }) {
  const data = useQuery(api.queries.stats.getGlobalToolLeaderboards) ?? initialData;
  const [metric, setMetric] = useQueryState(
    "metric",
    parseAsStringLiteral(metrics).withDefault("commits").withOptions({ scroll: false })
  );
  const hasTrackedInitialMetric = useRef(false);
  const [sorting, setSorting] = useState<SortingState>(() => metricToSorting(metric));

  useEffect(() => {
    if (!hasTrackedInitialMetric.current) {
      hasTrackedInitialMetric.current = true;
      return;
    }
    trackEvent("leaderboard_metric_toggle", { section: "ai-tools", metric });
  }, [metric]);

  useEffect(() => {
    setSorting(metricToSorting(metric));
  }, [metric]);

  const table = useReactTable({
    data: data.aiTools,
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
      additions: table.getColumn("additions"),
      repos: table.getColumn("repoCount"),
      owners: table.getColumn("ownerCount"),
    }),
    [table]
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">AI Tools</h2>
        <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1">
          {metrics.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                void setMetric(value);
                setSorting(metricToSorting(value));
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                metric === value ? "bg-white text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              {value === "loc" ? "Code Volume" : "Commits"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/70 text-left text-xs uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Tool</th>
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
                  onClick={() => sortColumns.additions?.toggleSorting()}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Code Volume {sortIndicator(sortColumns.additions?.getIsSorted() ?? false)}
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
              const tool = row.original;
              return (
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
                    {formatCompactNumber(tool.commits)}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {formatCompactNumber(tool.additions)}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {formatCompactNumber(tool.repoCount)}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {formatCompactNumber(tool.ownerCount)}
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
