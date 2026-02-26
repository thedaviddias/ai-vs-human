import { fetchQuery } from "convex/nextjs";
import { LeaderboardViewTracker } from "@/components/analytics/LeaderboardViewTracker";
import { SkillsLeaderboardContent } from "@/components/pages/leaderboard/SkillsLeaderboardContent";
import { api } from "@/convex/_generated/api";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Agent Skills Leaderboard",
  description:
    "Discover the most popular AI agent skills, .cursorrules, and instructions used across top open-source repositories.",
  path: "/leaderboard/skills",
  keywords: [
    "ai agent skills",
    "cursor rules",
    "github copilot instructions",
    "ai configuration",
    "skills.sh",
  ],
});

export default async function LeaderboardSkillsPage() {
  const data = await fetchQuery(api.queries.stats.getGlobalSkillsLeaderboard);

  return (
    <>
      <LeaderboardViewTracker section="skills" />
      <SkillsLeaderboardContent initialData={data} />
    </>
  );
}
