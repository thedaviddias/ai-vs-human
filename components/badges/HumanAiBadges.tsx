"use client";

import { Bot, User } from "lucide-react";

interface HumanAiBadgesProps {
  humanPercentage: string;
  aiPercentage: string;
  aiLabel?: string;
}

export function HumanAiBadges({
  humanPercentage,
  aiPercentage,
  aiLabel = "AI/Bot",
}: HumanAiBadgesProps) {
  const aiValue = Number.parseFloat(aiPercentage);
  const showAiBadge = Number.isFinite(aiValue) ? aiValue > 0 : true;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
        <User className="h-3 w-3" />
        Human {humanPercentage}%
      </span>
      {showAiBadge && (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          <Bot className="h-3 w-3" />
          {aiLabel} {aiPercentage}%
        </span>
      )}
    </div>
  );
}
