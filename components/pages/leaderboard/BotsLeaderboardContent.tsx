"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
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

export function BotsLeaderboardContent({ initialData }: { initialData: ToolLeaderboardsData }) {
  const data = useQuery(api.queries.stats.getGlobalToolLeaderboards) ?? initialData;

  const rows = useMemo(() => {
    return [...data.bots].sort(
      (a, b) =>
        b.commits - a.commits ||
        b.repoCount - a.repoCount ||
        b.ownerCount - a.ownerCount ||
        a.label.localeCompare(b.label)
    );
  }, [data.bots]);

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
              <th className="px-4 py-3">Commits</th>
              <th className="px-4 py-3">Repos</th>
              <th className="px-4 py-3">Owners</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((bot, index) => (
              <tr key={bot.key} className="border-t border-neutral-800/80 hover:bg-neutral-900/40">
                <td className="px-4 py-3 font-semibold text-neutral-400">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <BotLogo botKey={bot.key} label={bot.label} />
                    <span className="font-semibold text-white">{bot.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-200">{formatCompactNumber(bot.commits)}</td>
                <td className="px-4 py-3 text-neutral-300">{formatCompactNumber(bot.repoCount)}</td>
                <td className="px-4 py-3 text-neutral-300">
                  {formatCompactNumber(bot.ownerCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
