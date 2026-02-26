import { fetchQuery } from "convex/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import robots from "../../app/robots";
import sitemap from "../../app/sitemap";
import { canonicalUrl, createMetadata, DEFAULT_KEYWORDS, formatTitle } from "../seo";

vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(),
}));

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

describe("seo helpers", () => {
  const fetchQueryMock = vi.mocked(fetchQuery);

  beforeEach(() => {
    fetchQueryMock.mockReset();
  });

  it("formats title with site suffix by default", () => {
    expect(formatTitle("About")).toBe("About | AI vs Human");
  });

  it("keeps title unchanged when noSuffix is true", () => {
    expect(formatTitle("About", true)).toBe("About");
  });

  it("builds absolute canonical URLs", () => {
    expect(canonicalUrl("/docs")).toBe("https://aivshuman.dev/docs");
    expect(canonicalUrl("docs")).toBe("https://aivshuman.dev/docs");
  });

  it("creates metadata with merged deduplicated keywords", () => {
    const metadata = createMetadata({
      title: "About",
      description: "About page",
      path: "/docs",
      keywords: [DEFAULT_KEYWORDS[0], "custom-keyword"],
    });

    expect(metadata.alternates?.canonical).toBe("https://aivshuman.dev/docs");

    const keywords = metadata.keywords as string[];
    expect(keywords).toContain("custom-keyword");
    expect(keywords.filter((word) => word === DEFAULT_KEYWORDS[0])).toHaveLength(1);
  });

  it("supports nested docs canonical paths", () => {
    const metadata = createMetadata({
      title: "Developer Ranks",
      description: "Rank documentation",
      path: "/docs/ranks",
    });

    expect(metadata.alternates?.canonical).toBe("https://aivshuman.dev/docs/ranks");
  });

  it("preserves encoded dynamic canonical paths", () => {
    const encodedOwner = encodeURIComponent("acme dev");
    const encodedRepo = encodeURIComponent("core api");

    const metadata = createMetadata({
      title: "Repo Analysis",
      description: "Dynamic repo page",
      path: `/${encodedOwner}/${encodedRepo}`,
    });

    expect(metadata.alternates?.canonical).toBe("https://aivshuman.dev/acme%20dev/core%20api");
  });

  it("sets noindex robots directives when requested", () => {
    const metadata = createMetadata({
      title: "Private Page",
      description: "Private page",
      noIndex: true,
    });

    expect(metadata.robots).toEqual({
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    });
  });

  it("keeps /api disallowed while allowing framework assets in robots", () => {
    const robotsConfig = robots();
    const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules : [robotsConfig.rules];
    const crawlerRules = rules.filter(
      (rule) => rule.userAgent === "*" || rule.userAgent === "Googlebot"
    );

    expect(crawlerRules.length).toBeGreaterThan(0);

    for (const rule of crawlerRules) {
      const disallow = toArray(rule.disallow);
      expect(disallow).toContain("/api/");
      expect(disallow).not.toContain("/_next/");
    }
  });

  it("includes repo URLs in sitemap entries", async () => {
    fetchQueryMock
      .mockResolvedValueOnce([{ owner: "octocat", lastIndexedAt: 1_727_000_000_000 }])
      .mockResolvedValueOnce([
        {
          owner: "octocat",
          name: "hello-world",
          lastSyncedAt: 1_727_000_100_000,
          requestedAt: 1_726_999_900_000,
        },
      ]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://aivshuman.dev/octocat");
    expect(urls).toContain("https://aivshuman.dev/octocat/hello-world");
    expect(urls).toContain("https://aivshuman.dev/leaderboard");
    expect(urls).toContain("https://aivshuman.dev/leaderboard/developers");
    expect(urls).toContain("https://aivshuman.dev/leaderboard/repos");
    expect(urls).toContain("https://aivshuman.dev/leaderboard/ai-tools");
    expect(urls).toContain("https://aivshuman.dev/leaderboard/bots");
  });
});
