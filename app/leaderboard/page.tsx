import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { LeaderboardViewTracker } from "@/components/analytics/LeaderboardViewTracker";
import { api } from "@/convex/_generated/api";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Leaderboards",
  description:
    "Explore ranked developers, repositories, AI tools, and automation bots across indexed open-source GitHub data.",
  path: "/leaderboard",
  keywords: [
    "open source leaderboard",
    "github stars leaderboard",
    "ai coding tool leaderboard",
    "automation bot leaderboard",
  ],
});

export default async function LeaderboardIndexPage() {
  const [users, repos, toolData] = await Promise.all([
    fetchQuery(api.queries.users.getIndexedUsersWithProfiles, {}),
    fetchQuery(api.queries.repos.getIndexedRepos),
    fetchQuery(api.queries.stats.getGlobalToolLeaderboards),
  ]);

  const topDeveloper = [...users].sort(
    (a, b) =>
      (b.publicTotalStars ?? b.totalStars ?? 0) - (a.publicTotalStars ?? a.totalStars ?? 0) ||
      (b.publicTotalCommits ?? b.totalCommits) - (a.publicTotalCommits ?? a.totalCommits) ||
      a.owner.localeCompare(b.owner)
  )[0];
  const topRepo = repos[0];
  const topAiTool = toolData.aiTools[0];
  const topBot = toolData.bots[0];

  const cards = [
    {
      title: "Developers",
      href: "/leaderboard/developers",
      value: users.length.toLocaleString(),
      subtitle: topDeveloper
        ? `Top by stars: @${topDeveloper.owner} (${(topDeveloper.publicTotalStars ?? topDeveloper.totalStars).toLocaleString()})`
        : "No indexed developers yet.",
    },
    {
      title: "Repositories",
      href: "/leaderboard/repos",
      value: repos.length.toLocaleString(),
      subtitle: topRepo
        ? `Top by stars: ${topRepo.fullName} (${(topRepo.stars ?? 0).toLocaleString()})`
        : "No indexed repositories yet.",
    },
    {
      title: "AI Tools",
      href: "/leaderboard/ai-tools",
      value: toolData.aiTools.length.toLocaleString(),
      subtitle: topAiTool
        ? `Most used: ${topAiTool.label} (${topAiTool.commits.toLocaleString()} commits)`
        : "No AI tool usage yet.",
    },
    {
      title: "Bots",
      href: "/leaderboard/bots",
      value: toolData.bots.length.toLocaleString(),
      subtitle: topBot
        ? `Most active: ${topBot.label} (${topBot.commits.toLocaleString()} commits)`
        : "No bot activity yet.",
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <LeaderboardViewTracker section="index" />
      <h2 className="text-xl font-bold text-white sm:text-2xl">Overview</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 transition-all hover:border-neutral-700 hover:bg-neutral-900/50"
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {card.title}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-white">{card.value}</div>
            <div className="mt-2 text-sm text-neutral-400">{card.subtitle}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
