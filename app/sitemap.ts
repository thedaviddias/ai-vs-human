import { fetchQuery } from "convex/nextjs";
import type { MetadataRoute } from "next";
import { api } from "@/convex/_generated/api";
import { siteConfig } from "@/lib/constants";

const MAX_REPO_ENTRIES = 5_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/docs`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteConfig.url}/docs/ranks`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/leaderboard/developers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/leaderboard/repos`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/leaderboard/ai-tools`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${siteConfig.url}/leaderboard/bots`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
  ];

  try {
    const [users, repos] = await Promise.all([
      fetchQuery(api.queries.users.getIndexedUsers),
      fetchQuery(api.queries.repos.getIndexedRepos),
    ]);

    for (const user of users) {
      entries.push({
        url: `${siteConfig.url}/${user.owner}`,
        lastModified: new Date(user.lastIndexedAt),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    for (const repo of repos.slice(0, MAX_REPO_ENTRIES)) {
      entries.push({
        url: `${siteConfig.url}/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`,
        lastModified: new Date(repo.lastSyncedAt ?? repo.requestedAt),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // Sitemap still works with static pages if Convex is unavailable
  }

  return entries;
}
