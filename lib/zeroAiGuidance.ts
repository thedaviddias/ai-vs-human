interface ShouldShowZeroAiGuidanceArgs {
  showZeroAiWhyCta: boolean;
  botPercentage: string;
  totalCommits: number;
}

export function shouldShowZeroAiGuidance({
  showZeroAiWhyCta,
  botPercentage,
  totalCommits,
}: ShouldShowZeroAiGuidanceArgs): boolean {
  if (!showZeroAiWhyCta || totalCommits <= 0) return false;
  return Number.parseFloat(botPercentage) === 0;
}
