import type { ReactNode } from "react";
import { LeaderboardNav } from "@/components/layout/LeaderboardNav";

export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="py-8">
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Leaderboards</h1>
        <p className="max-w-3xl text-sm text-neutral-400 sm:text-base">
          Explore top developers, repositories, AI tools, and automation bots across indexed public
          GitHub data.
        </p>
      </div>

      <div className="lg:hidden">
        <LeaderboardNav mode="tabs" />
      </div>

      <div className="mt-6 grid gap-8 lg:mt-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <LeaderboardNav mode="sidebar" />
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
