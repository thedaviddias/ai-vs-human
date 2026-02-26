import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";
import { getAnalyzeApiKey } from "@/lib/server/analyzeApiKey";
import { requireHumanRequest } from "@/lib/server/botProtection";

interface AnalyzeUserRepoInput {
  owner: string;
  name: string;
  pushedAt?: number;
}

interface AnalyzeUserRequest {
  repos?: AnalyzeUserRepoInput[];
}

export async function POST(request: Request) {
  const guard = await requireHumanRequest();
  if (!guard.allowed) {
    return guard.response;
  }

  const apiKey = getAnalyzeApiKey();
  if (!apiKey) {
    logger.error("ANALYZE_API_KEY is not configured in Next.js environment");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let body: AnalyzeUserRequest;
  try {
    body = (await request.json()) as AnalyzeUserRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repos = body.repos;
  if (!Array.isArray(repos) || repos.length === 0) {
    return NextResponse.json({ error: "repos must be a non-empty array" }, { status: 400 });
  }

  const normalizedRepos = repos
    .filter(
      (repo): repo is AnalyzeUserRepoInput =>
        Boolean(repo) && typeof repo.owner === "string" && typeof repo.name === "string"
    )
    .map((repo) => ({
      owner: repo.owner.trim(),
      name: repo.name.trim(),
      ...(typeof repo.pushedAt === "number" ? { pushedAt: repo.pushedAt } : {}),
    }))
    .filter((repo) => repo.owner.length > 0 && repo.name.length > 0);

  if (normalizedRepos.length === 0) {
    return NextResponse.json(
      { error: "repos must include valid owner and name values" },
      { status: 400 }
    );
  }

  const _owner = normalizedRepos[0].owner;

  try {
    // 1. Request the analysis
    const result = await fetchMutation(api.mutations.requestUserAnalysis.requestUserAnalysis, {
      repos: normalizedRepos,
      apiKey,
    });

    // Profile caching is handled by the ingestion pipeline (fetchRepo.ts).
    // No need for a redundant background fetch here.

    logger.info("User analysis triggered", { owner: _owner, repoCount: normalizedRepos.length });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("User analysis mutation failed", error, {
      owner: _owner,
      repoCount: normalizedRepos.length,
    });
    const message = error instanceof Error ? error.message : "Failed to request analysis";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
