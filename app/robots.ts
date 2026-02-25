import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og/"],
        disallow: ["/api/"],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/api/og/"],
        disallow: ["/api/"],
      },
      // Social preview bots need unrestricted access to fetch page HTML and OG
      // images. They don't follow RFC 9309 "most specific wins" for competing
      // Allow/Disallow rules, so we avoid Disallow entirely for these bots.
      // API endpoints are protected by BotID at the application level.
      {
        userAgent: "Twitterbot",
        allow: "/",
      },
      {
        userAgent: "facebookexternalhit",
        allow: "/",
      },
      {
        userAgent: "LinkedInBot",
        allow: "/",
      },
    ],
    host: siteConfig.url,
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
