"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/tracking";

interface LeaderboardViewTrackerProps {
  section: "index" | "developers" | "repos" | "ai-tools" | "bots";
}

export function LeaderboardViewTracker({ section }: LeaderboardViewTrackerProps) {
  useEffect(() => {
    trackEvent("leaderboard_view", { section });
  }, [section]);

  return null;
}
