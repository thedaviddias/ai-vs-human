export function hasValidAnalyzeApiKey(apiKey: string): boolean {
  const configuredApiKey = process.env.ANALYZE_API_KEY;
  if (!configuredApiKey) {
    console.error("ANALYZE_API_KEY not set in Convex environment");
    return false;
  }

  const normalizedConfigured = configuredApiKey.trim();
  const normalizedIncoming = apiKey.trim();

  if (normalizedConfigured === "") return false;

  return normalizedIncoming === normalizedConfigured;
}
