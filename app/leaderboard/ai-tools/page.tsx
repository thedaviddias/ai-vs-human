import { fetchQuery } from "convex/nextjs";
import { LeaderboardViewTracker } from "@/components/analytics/LeaderboardViewTracker";
import { AiToolsLeaderboardContent } from "@/components/pages/leaderboard/AiToolsLeaderboardContent";
import { api } from "@/convex/_generated/api";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "AI Tools Leaderboard",
  description:
    "See which AI coding and review tools are most used across indexed repositories by commits and code volume.",
  path: "/leaderboard/ai-tools",
  keywords: [
    "ai tools leaderboard",
    "github ai tools usage",
    "copilot claude cursor ranking",
    "ai coding tools open source",
  ],
});

export default async function LeaderboardAiToolsPage() {
  const data = await fetchQuery(api.queries.stats.getGlobalToolLeaderboards);

  return (
    <>
      <LeaderboardViewTracker section="ai-tools" />
      <AiToolsLeaderboardContent initialData={data} />
    </>
  );
}
