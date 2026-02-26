export interface LeaderboardNavItem {
  label: string;
  href: string;
  description?: string;
}

export const LEADERBOARD_NAV: LeaderboardNavItem[] = [
  {
    label: "Overview",
    href: "/leaderboard",
    description: "Entry point with current indexed leaderboard snapshots.",
  },
  {
    label: "Developers",
    href: "/leaderboard/developers",
    description: "Ranked by accumulated stars, commits, followers, and freshness.",
  },
  {
    label: "Repos",
    href: "/leaderboard/repos",
    description: "Most starred and recently synced repositories.",
  },
  {
    label: "Agent Skills",
    href: "/leaderboard/skills",
    description: "Most popular AI configurations and agent skills.",
  },
  {
    label: "AI Tools",
    href: "/leaderboard/ai-tools",
    description: "Most used AI coding and review tools across indexed repos.",
  },
  {
    label: "Bots",
    href: "/leaderboard/bots",
    description: "Most active automation bots across indexed repositories.",
  },
];
