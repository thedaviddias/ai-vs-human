import { fetchQuery } from "convex/nextjs";
import { LeaderboardViewTracker } from "@/components/analytics/LeaderboardViewTracker";
import { ReposLeaderboardContent } from "@/components/pages/leaderboard/ReposLeaderboardContent";
import { api } from "@/convex/_generated/api";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Repository Leaderboard",
  description:
    "Rank indexed repositories by stars, latest sync activity, and ownership across public open-source projects.",
  path: "/leaderboard/repos",
  keywords: [
    "repository leaderboard",
    "open source stars leaderboard",
    "github repo ranking",
    "top indexed repositories",
  ],
});

export default async function LeaderboardReposPage() {
  const repos = await fetchQuery(api.queries.repos.getIndexedRepos);

  return (
    <>
      <LeaderboardViewTracker section="repos" />
      <ReposLeaderboardContent initialRepos={repos} />
    </>
  );
}
