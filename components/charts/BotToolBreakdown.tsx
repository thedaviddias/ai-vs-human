"use client";

import {
  SiCodecov,
  SiDependabot,
  SiGithubactions,
  SiNetlify,
  SiRenovate,
  SiSemanticrelease,
  SiSentry,
  SiSnyk,
  SiSonar,
  SiVercel,
} from "@icons-pack/react-simple-icons";
import { Bot } from "lucide-react";
import { useMemo } from "react";
import { type BotToolBreakdownItem, sortBotBreakdown } from "./toolBreakdownSort";

interface BotToolBreakdownProps {
  botBreakdown: BotToolBreakdownItem[];
}

const BotIcons: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  dependabot: SiDependabot,
  renovate: SiRenovate,
  "github-actions": SiGithubactions,
  "semantic-release": SiSemanticrelease,
  "snyk-bot": SiSnyk,
  "sentry-bot": SiSentry,
  codecov: SiCodecov,
  sonarcloud: SiSonar,
  vercel: SiVercel,
  v1: SiVercel,
  "bot-v1": SiVercel,
  netlify: SiNetlify,
};

const BOT_COLORS: Record<string, string> = {
  dependabot: "text-[#025E8C]",
  renovate: "text-amber-500",
  "github-actions": "text-[#2088FF]",
  "semantic-release": "text-[#494949] dark:text-neutral-300",
  "snyk-bot": "text-[#4C4A73]",
  "sentry-bot": "text-[#362D59]",
  codecov: "text-[#F01F7A]",
  sonarcloud: "text-[#F3702A]",
  vercel: "text-white",
  v1: "text-white",
  "bot-v1": "text-white",
  netlify: "text-[#00C7B7]",
};

const BOT_URLS: Record<string, string> = {
  dependabot: "https://github.com/dependabot",
  renovate: "https://docs.renovatebot.com",
  "github-actions": "https://github.com/features/actions",
  "semantic-release": "https://semantic-release.gitbook.io",
  "snyk-bot": "https://snyk.io",
  "sentry-bot": "https://sentry.io",
  codecov: "https://codecov.io",
  sonarcloud: "https://sonarcloud.io",
  greenkeeper: "https://greenkeeper.io",
  imgbot: "https://imgbot.net",
  "all-contributors": "https://allcontributors.org",
  "release-please": "https://github.com/googleapis/release-please",
  mergify: "https://mergify.com",
  vercel: "https://vercel.com",
  v1: "https://vercel.com",
  "bot-v1": "https://vercel.com",
  netlify: "https://netlify.com",
  changesets: "https://github.com/changesets/changesets",
  kodiak: "https://kodiakhq.com",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function BotToolBreakdown({ botBreakdown }: BotToolBreakdownProps) {
  const bots = useMemo(() => {
    if (!botBreakdown) return [];
    const filtered = botBreakdown.filter((bot) => bot.commits > 0);
    return sortBotBreakdown(filtered);
  }, [botBreakdown]);

  if (bots.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-500">
          Automation Bot Breakdown
        </h3>
        <div className="h-px flex-1 bg-neutral-800/50" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {bots.map((bot) => {
          const Icon = BotIcons[bot.key] ?? Bot;
          const color = BOT_COLORS[bot.key] ?? "text-amber-600";
          const isSimpleIcon = bot.key in BotIcons && Icon !== Bot;
          const url = BOT_URLS[bot.key];
          const Wrapper = url ? "a" : "div";
          const wrapperProps = url
            ? { href: url, target: "_blank" as const, rel: "noopener noreferrer" }
            : {};

          return (
            <Wrapper key={bot.key} {...wrapperProps}>
              <div
                className={`flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4${url ? " transition-colors hover:border-neutral-700 hover:bg-neutral-900/60" : ""}`}
              >
                <div
                  className={`flex shrink-0 items-center justify-center rounded-lg h-10 w-10 bg-black/20 border border-neutral-800 ${color}`}
                >
                  {isSimpleIcon ? <Icon size={20} /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    {bot.label}
                  </div>
                  <div className="text-lg font-bold text-white">
                    {formatNumber(bot.commits)}
                    <span className="ml-1.5 text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
                      Commits
                    </span>
                  </div>
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
