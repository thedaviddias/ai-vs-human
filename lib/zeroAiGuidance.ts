interface ShouldShowAttributionGuidanceArgs {
  showZeroAiWhyCta: boolean;
  botPercentage: string;
  totalCommits: number;
}

/**
 * Determines if we should show guidance about AI attribution.
 * This triggers when AI percentage is 0% (indicating potential missing markers)
 * or very low (indicating mostly manual work).
 */
export function shouldShowAttributionGuidance({
  showZeroAiWhyCta,
  botPercentage,
  totalCommits,
}: ShouldShowAttributionGuidanceArgs): boolean {
  if (!showZeroAiWhyCta || totalCommits <= 0) return false;

  const percentage = Number.parseFloat(botPercentage);
  // Show guidance if AI use is below 5%, suggesting it's mostly manual work
  // or attribution markers are missing.
  return percentage < 5;
}

/**
 * Returns a specific message key based on the AI percentage level.
 */
export function getAttributionGuidanceType(botPercentage: string): "zero" | "low" | "none" {
  const percentage = Number.parseFloat(botPercentage);
  if (percentage === 0) return "zero";
  if (percentage < 5) return "low";
  return "none";
}

const GUIDANCE_SEEN_KEY = "avh:zero-ai-guidance-seen";

/**
 * Returns true if the user has already dismissed the attribution guidance modal.
 * Client-only — returns false during SSR.
 */
export function hasSeenAttributionGuidance(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GUIDANCE_SEEN_KEY) !== null;
}

/**
 * Records that the user has seen (and dismissed) the attribution guidance modal.
 * Client-only — no-op during SSR.
 */
export function markAttributionGuidanceSeen(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUIDANCE_SEEN_KEY, Date.now().toString());
}
