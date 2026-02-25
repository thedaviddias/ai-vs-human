"use client";

import { Bot, User } from "lucide-react";

interface HumanAiBadgesProps {
  humanPercentage: string;
  aiPercentage: string;
  automationPercentage?: string;
  aiLabel?: string;
}

export function HumanAiBadges({
  humanPercentage,
  aiPercentage,
  automationPercentage,
  aiLabel = "AI",
}: HumanAiBadgesProps) {
  const aiValue = Number.parseFloat(aiPercentage);
  const showAiBadge = Number.isFinite(aiValue) ? aiValue > 0 : true;

  const automationValue = automationPercentage ? Number.parseFloat(automationPercentage) : 0;
  const showAutomationBadge = Number.isFinite(automationValue) ? automationValue > 0 : false;

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
      {showAutomationBadge && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <Bot className="h-3 w-3" />
          Bot {automationPercentage}%
        </span>
      )}
    </div>
  );
}
