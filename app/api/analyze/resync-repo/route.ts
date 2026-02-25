import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";
import { getAnalyzeApiKey } from "@/lib/server/analyzeApiKey";
import { requireHumanRequest } from "@/lib/server/botProtection";

interface ResyncRepoRequest {
  owner?: string;
  name?: string;
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

  let body: ResyncRepoRequest;
  try {
    body = (await request.json()) as ResyncRepoRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const owner = body.owner?.trim();
  const name = body.name?.trim();
  if (!owner || !name) {
    return NextResponse.json({ error: "owner and name are required" }, { status: 400 });
  }

  try {
    const clientIp = getClientIp(request);
    const ipHash = await hashValue(clientIp);

    const result = await fetchMutation(api.mutations.resyncRepo.resyncRepo, {
      owner,
      name,
      ipHash,
      apiKey,
    });

    if (!result.allowed) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Repository not found" }, { status: 404 });
      }
      if (result.reason === "already_in_progress") {
        return NextResponse.json(
          { error: "Sync is already in progress for this repository" },
          { status: 409 }
        );
      }
      // Rate limit responses (cooldown / daily_cap)
      return NextResponse.json(
        {
          error: formatRetryMessage(
            result.reason as "cooldown" | "daily_cap",
            result.retryAfterSeconds
          ),
          retryAfterSeconds: result.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfterSeconds) },
        }
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error("Resync repo mutation failed", error);
    return NextResponse.json({ error: "Failed to re-sync repo" }, { status: 500 });
  }
}
