import type { Metadata } from "next";
import { siteConfig } from "@/lib/constants";

const SEO_CONFIG = {
  locale: "en_US",
  authorName: "David Dias",
  authorUrl: "https://thedaviddias.com",
  xHandle: "@thedaviddias",
  defaultOGImage: "/api/og/global",
} as const;

export const DEFAULT_KEYWORDS: string[] = [
  "AI vs Human",
  "AI generated code",
  "human written code",
  "GitHub commit analysis",
  "open source AI usage",
  "Claude code analysis",
  "Copilot code analysis",
  "developer productivity",
];

interface MetadataConfig {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: "website" | "article" | "profile";
  noSuffix?: boolean;
  noIndex?: boolean;
}

export function formatTitle(title: string, noSuffix = false): string {
  if (noSuffix || title === siteConfig.name) {
    return title;
  }

  return `${title} | ${siteConfig.name}`;
}

export function canonicalUrl(path = "/"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.url}${cleanPath}`;
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return canonicalUrl(url);
}

export function createMetadata(config: MetadataConfig): Metadata {
  const {
    title,
    description,
    path = "/",
    keywords = [],
    ogImage = SEO_CONFIG.defaultOGImage,
    ogImageAlt = `${title} - ${siteConfig.name}`,
    ogType = "website",
    noSuffix = false,
    noIndex = false,
  } = config;

  const socialTitle = formatTitle(title, noSuffix);
  const url = canonicalUrl(path);
  const image = toAbsoluteUrl(ogImage);
  const allKeywords = [...new Set([...DEFAULT_KEYWORDS, ...keywords])];

  const metadata: Metadata = {
    title: noSuffix ? { absolute: title } : title,
    description,
    keywords: allKeywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: socialTitle,
      description,
      url,
      siteName: siteConfig.name,
      type: ogType,
      locale: SEO_CONFIG.locale,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: ogImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      creator: SEO_CONFIG.xHandle,
      images: [image],
    },
  };

  if (noIndex) {
    metadata.robots = {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    };
  }

  return metadata;
}

export function createDynamicMetadata(config: MetadataConfig): Metadata {
  return createMetadata(config);
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "AI vs Human — Who's writing open source?",
    template: `%s | ${siteConfig.name}`,
  },
  description:
    "Visualize how much of open source is written by AI vs humans. Analyze any GitHub repo to see commit breakdowns by Claude, Copilot, Dependabot, and more.",
  applicationName: siteConfig.name,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SEO_CONFIG.authorName, url: SEO_CONFIG.authorUrl }],
  creator: SEO_CONFIG.authorName,
  publisher: siteConfig.name,
  openGraph: {
    title: siteConfig.name,
    description:
      "Visualize how much of open source is written by AI vs humans. Analyze any GitHub repo to see commit breakdowns by Claude, Copilot, Dependabot, and more.",
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
    locale: SEO_CONFIG.locale,
    images: [
      {
        url: toAbsoluteUrl(SEO_CONFIG.defaultOGImage),
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description:
      "Visualize how much of open source is written by AI vs humans. Analyze any GitHub repo to see commit breakdowns by Claude, Copilot, Dependabot, and more.",
    creator: SEO_CONFIG.xHandle,
    images: [toAbsoluteUrl(SEO_CONFIG.defaultOGImage)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: siteConfig.url,
  },
};
