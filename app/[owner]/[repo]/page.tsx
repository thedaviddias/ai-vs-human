import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { RepoDashboardContent } from "@/components/pages/RepoDashboardContent";
import { api } from "@/convex/_generated/api";
import { createMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
  const { owner, repo } = await params;
  const fullName = `${owner}/${repo}`;
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);

  return createMetadata({
    title: fullName,
    noSuffix: true,
    description: `See how much of ${fullName} is authored by humans versus AI coding tools, with commit and code volume breakdowns.`,
    path: `/${encodedOwner}/${encodedRepo}`,
    ogImage: `/api/og/repo?owner=${encodedOwner}&name=${encodedRepo}`,
    keywords: [
      `${fullName} AI analysis`,
      `${fullName} commit breakdown`,
      `${repo} human vs AI code`,
    ],
  });
}

export default async function RepoPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo: repoName } = await params;
  const fullName = `${owner}/${repoName}`;

  // Parallel fetch initial data on the server for zero-CLS and faster TTFB
  const [repoData, summary, dailyStats, contributors] = await Promise.all([
    fetchQuery(api.queries.repos.getRepoBySlug, { owner, name: repoName }),
    fetchQuery(api.queries.stats.getRepoSummary, { repoFullName: fullName }),
    fetchQuery(api.queries.stats.getDailyStats, { repoFullName: fullName }),
    fetchQuery(api.queries.contributors.getContributorBreakdown, { repoFullName: fullName }),
  ]);

  return (
    <RepoDashboardContent
      owner={owner}
      repoName={repoName}
      initialRepo={repoData}
      initialSummary={summary}
      initialDailyStats={dailyStats ?? []}
      initialContributors={contributors ?? []}
    />
  );
}
