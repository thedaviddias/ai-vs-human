"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef } from "react";
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
}

const sortModes = ["stars", "latest", "owner"] as const;

export function ReposLeaderboardContent({ initialRepos }: { initialRepos: IndexedRepoData[] }) {
  const repos = useQuery(api.queries.repos.getIndexedRepos) ?? initialRepos;
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
    trackEvent("leaderboard_sort_change", { section: "repos", sort: sortMode });
  }, [sortMode]);

  const sortedRepos = useMemo(() => {
    const base = [...repos];
    return base.sort((a, b) => {
      switch (sortMode) {
        case "latest":
          return (
            (b.lastSyncedAt ?? b.requestedAt) - (a.lastSyncedAt ?? a.requestedAt) ||
            (b.stars ?? 0) - (a.stars ?? 0) ||
            a.fullName.localeCompare(b.fullName)
          );
        case "owner":
          return (
            a.owner.localeCompare(b.owner) ||
            (b.stars ?? 0) - (a.stars ?? 0) ||
            a.name.localeCompare(b.name)
          );
        default:
          return (
            (b.stars ?? 0) - (a.stars ?? 0) ||
            (b.lastSyncedAt ?? b.requestedAt) - (a.lastSyncedAt ?? a.requestedAt) ||
            a.fullName.localeCompare(b.fullName)
          );
      }
    });
  }, [repos, sortMode]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Repositories</h2>
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

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/70 text-left text-xs uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Repository</th>
              <th className="px-4 py-3">Stars</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Last Synced</th>
            </tr>
          </thead>
          <tbody>
            {sortedRepos.map((repo, index) => (
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
                <td className="px-4 py-3 font-semibold text-amber-300">
                  {formatCompactNumber(repo.stars ?? 0)}
                </td>
                <td className="px-4 py-3 text-neutral-300">@{repo.owner}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {formatDateTime(repo.lastSyncedAt ?? repo.requestedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
