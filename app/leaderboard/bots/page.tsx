import { fetchQuery } from "convex/nextjs";
import { LeaderboardViewTracker } from "@/components/analytics/LeaderboardViewTracker";
import { BotsLeaderboardContent } from "@/components/pages/leaderboard/BotsLeaderboardContent";
import { api } from "@/convex/_generated/api";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Automation Bots Leaderboard",
  description:
    "Track which automation bots are most active across indexed repositories, including commit, repo, and owner coverage.",
  path: "/leaderboard/bots",
  keywords: [
    "automation bot leaderboard",
    "github bot usage",
    "dependabot renovate activity",
    "open source automation ranking",
  ],
});

export default async function LeaderboardBotsPage() {
  const data = await fetchQuery(api.queries.stats.getGlobalToolLeaderboards);

  return (
    <>
      <LeaderboardViewTracker section="bots" />
      <BotsLeaderboardContent initialData={data} />
    </>
  );
}
