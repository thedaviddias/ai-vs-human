import { fetchQuery } from "convex/nextjs";
import { LeaderboardViewTracker } from "@/components/analytics/LeaderboardViewTracker";
import { DevelopersLeaderboardContent } from "@/components/pages/leaderboard/DevelopersLeaderboardContent";
import { api } from "@/convex/_generated/api";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Developer Leaderboard",
  description:
    "Rank developers by accumulated repository stars, total commits, and contribution mix across indexed open-source projects.",
  path: "/leaderboard/developers",
  keywords: [
    "developer leaderboard",
    "github stars accumulated",
    "human ai contribution ranking",
    "open source developer ranking",
  ],
});

export default async function LeaderboardDevelopersPage() {
  const users = await fetchQuery(api.queries.users.getIndexedUsersWithProfiles);

  return (
    <>
      <LeaderboardViewTracker section="developers" />
      <DevelopersLeaderboardContent initialUsers={users} />
    </>
  );
}
