export function getAnalyzeApiKey(): string | null {
  const apiKey = process.env.ANALYZE_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return apiKey;
}
