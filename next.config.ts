import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import { withPlausibleProxy } from "next-plausible";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  experimental: {
    mdxRs: {
      mdxType: "gfm",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://plausible.io https://*.sentry.io; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://github.com https://avatars.githubusercontent.com https://aivshuman.dev; font-src 'self'; connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://plausible.io https://api.github.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*; frame-src 'self'; worker-src 'self' blob:;",
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX();

// BotID proxy rewrites only on Vercel — in local dev the proxy tries to
// TLS-connect to api.vercel.com via Node's built-in fetch, which fails
// with EBADF on Node ≥25. The server-side guard in requireHumanRequest()
// already skips BotID when VERCEL !== "1", so this is safe.
const isVercel = process.env.VERCEL === "1";
const configWithMDX = withMDX(withPlausibleProxy()(nextConfig));
const configWithBotId = isVercel ? withBotId(configWithMDX) : configWithMDX;

export default withSentryConfig(configWithBotId, {
  // Suppress source map upload logs in CI
  silent: !process.env.CI,

  // Source maps: disable upload unless auth token is provided
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // Automatically tree-shake Sentry debug statements to reduce bundle size
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
