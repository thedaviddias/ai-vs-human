import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

type BotProtectionResult =
  | { allowed: true }
  | { allowed: false; response: NextResponse<{ error: string }> };

/**
 * Enforce BotID only on Vercel where request context/OIDC are available.
 */
export async function requireHumanRequest(): Promise<BotProtectionResult> {
  if (process.env.VERCEL !== "1") {
    return { allowed: true };
  }

  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return {
        allowed: false,
        response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
      };
    }

    return { allowed: true };
  } catch (error) {
    logger.error("BotID verification failed", error);
    return {
      allowed: false,
      response: NextResponse.json({ error: "Bot protection unavailable" }, { status: 503 }),
    };
  }
}
