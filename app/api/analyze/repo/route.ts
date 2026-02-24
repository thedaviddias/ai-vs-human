import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";
import { getAnalyzeApiKey } from "@/lib/server/analyzeApiKey";
import { requireHumanRequest } from "@/lib/server/botProtection";

interface AnalyzeRepoRequest {
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

  let body: AnalyzeRepoRequest;
  try {
    body = (await request.json()) as AnalyzeRepoRequest;
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

    const result = await fetchMutation(api.mutations.requestRepo.requestRepo, {
      owner,
      name,
      ipHash,
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Repo analysis mutation failed", error);
    const message = error instanceof Error ? error.message : "Failed to request analysis";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
