import { fetchQuery } from "convex/nextjs";
import { Suspense } from "react";
import { Hero } from "@/components/layout/Hero";
import { HomeContent } from "@/components/pages/HomeContent";
import { api } from "@/convex/_generated/api";
import { siteConfig } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const revalidate = 60;

function isConnectionRefusedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const cause = (error as Error & { cause?: unknown }).cause as
    | { code?: string; message?: string }
    | undefined;

  const message = `${error.message} ${cause?.message ?? ""}`;
  return cause?.code === "ECONNREFUSED" || message.includes("ECONNREFUSED");
}

async function fetchHomeDataOrFallback<T>(label: string, queryPromise: Promise<T>, fallback: T) {
  try {
    return await queryPromise;
  } catch (error) {
    if (isConnectionRefusedError(error)) {
      logger.warn("Convex unavailable while rendering home page, using fallback data", {
        query: label,
      });
      return fallback;
    }
    throw error;
  }
}

export default async function Home() {
  // Parallel fetch initial data on the server for zero-CLS and faster TTFB
  const [globalStats, globalDailyStats, indexedUsers, globalToolLeaderboards] = await Promise.all([
    fetchHomeDataOrFallback(
      "queries.globalStats.getGlobalSummary",
      fetchQuery(api.queries.globalStats.getGlobalSummary),
      null
    ),
    fetchHomeDataOrFallback(
      "queries.globalStats.getGlobalDailyStats",
      fetchQuery(api.queries.globalStats.getGlobalDailyStats),
      []
    ),
    fetchHomeDataOrFallback(
      "queries.users.getIndexedUsersWithProfiles",
      fetchQuery(api.queries.users.getIndexedUsersWithProfiles, {}),
      []
    ),
    fetchHomeDataOrFallback(
      "queries.stats.getGlobalToolLeaderboards",
      fetchQuery(api.queries.stats.getGlobalToolLeaderboards),
      { aiTools: [], bots: [] }
    ),
  ]);

  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteConfig.url}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const softwareAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: siteConfig.url,
    description:
      "Analyze GitHub repositories to compare human-authored code and AI-assisted code contributions.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(webSiteJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(softwareAppJsonLd)}</script>
      <div className="space-y-24 pb-24">
        <Hero />
        <Suspense>
          <HomeContent
            initialGlobalStats={globalStats}
            initialGlobalDailyStats={globalDailyStats ?? []}
            initialIndexedUsers={indexedUsers}
            initialGlobalToolLeaderboards={globalToolLeaderboards}
          />
        </Suspense>
      </div>
    </>
  );
}
