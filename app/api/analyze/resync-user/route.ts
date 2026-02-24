import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";
import { getAnalyzeApiKey } from "@/lib/server/analyzeApiKey";
import { requireHumanRequest } from "@/lib/server/botProtection";

interface AnalyzeUserRepoInput {
  owner: string;
  name: string;
}

interface ResyncUserRequest {
  owner?: string;
  repos?: AnalyzeUserRepoInput[];
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return "unknown";
}

async function hashValue(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatRetryMessage(reason: "cooldown" | "daily_cap", retryAfterSeconds: number): string {
  const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
  const unit = retryAfterMinutes === 1 ? "minute" : "minutes";
  if (reason === "daily_cap") {
    return `Re-sync limit reached for today. Try again in ${retryAfterMinutes} ${unit}.`;
  }

  return `Re-sync is on cooldown. Try again in ${retryAfterMinutes} ${unit}.`;
}

export async function POST(request: Request) {
  const guard = await requireHumanRequest();
  if (!guard.allowed) {
    return guard.response;
  }

  const apiKey = getAnalyzeApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let body: ResyncUserRequest;
  try {
    body = (await request.json()) as ResyncUserRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const owner = body.owner?.trim();
  if (!owner) {
    return NextResponse.json({ error: "owner is required" }, { status: 400 });
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
    }))
    .filter((repo) => repo.owner.length > 0 && repo.name.length > 0);

  if (normalizedRepos.length === 0) {
    return NextResponse.json(
      { error: "repos must include valid owner and name values" },
      { status: 400 }
    );
  }

  const invalidOwnerRepo = normalizedRepos.find((repo) => repo.owner !== owner);
  if (invalidOwnerRepo) {
    return NextResponse.json(
      { error: "all repos must belong to the requested owner" },
      { status: 400 }
    );
  }

  try {
    const clientIp = getClientIp(request);
    const ipHash = await hashValue(clientIp);

    const resyncResult = await fetchMutation(api.mutations.resyncUser.resyncUser, {
      owner,
      ipHash,
      apiKey,
    });

    if (!resyncResult.allowed) {
      const retryAfterSeconds = resyncResult.retryAfterSeconds;
      return NextResponse.json(
        {
          error: formatRetryMessage(resyncResult.reason, retryAfterSeconds),
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        }
      );
    }

    const queuedRepos = await fetchMutation(api.mutations.requestUserAnalysis.requestUserAnalysis, {
      repos: normalizedRepos,
      apiKey,
    });

    return NextResponse.json({
      reset: resyncResult.reset,
      retryAfterSeconds: 0,
      queued: queuedRepos.length,
      results: queuedRepos,
    });
  } catch (error) {
    logger.error("Resync user mutation failed", error);
    return NextResponse.json({ error: "Failed to re-sync user" }, { status: 500 });
  }
}
