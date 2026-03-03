import { createHash, randomBytes } from "node:crypto";
import { type JWTPayload, jwtVerify, SignJWT } from "jose";

const DESKTOP_TOKEN_AUDIENCE = "desktop-sync";
const DESKTOP_TOKEN_ISSUER = "aivshuman-desktop";
const DESKTOP_TOKEN_EXPIRY = "30d";

interface DesktopTokenPayload {
  githubLogin: string;
}

interface VerifiedDesktopToken {
  githubLogin: string;
  jti: string;
}

function getDesktopTokenSecret(): string {
  const secret = process.env.DESKTOP_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error("DESKTOP_TOKEN_SECRET is not configured.");
  }
  return secret;
}

function getDesktopTokenKey() {
  return new TextEncoder().encode(getDesktopTokenSecret());
}

export function createDeviceCode(): string {
  // 128-bit entropy encoded as URL-safe text.
  return randomBytes(16).toString("base64url");
}

export function hashDeviceCode(deviceCode: string): string {
  return createHash("sha256").update(deviceCode).digest("hex");
}

export async function signDesktopToken(payload: DesktopTokenPayload): Promise<string> {
  return await new SignJWT({
    sub: payload.githubLogin,
    aud: DESKTOP_TOKEN_AUDIENCE,
    iss: DESKTOP_TOKEN_ISSUER,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setJti(randomBytes(16).toString("hex"))
    .setExpirationTime(DESKTOP_TOKEN_EXPIRY)
    .sign(getDesktopTokenKey());
}

function parseClaims(claims: JWTPayload): VerifiedDesktopToken {
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new Error("Desktop token is missing sub claim.");
  }
  if (typeof claims.jti !== "string" || claims.jti.length === 0) {
    throw new Error("Desktop token is missing jti claim.");
  }

  return {
    githubLogin: claims.sub,
    jti: claims.jti,
  };
}

export async function verifyDesktopBearerToken(
  authorizationHeader: string | null
): Promise<VerifiedDesktopToken> {
  if (!authorizationHeader) {
    throw new Error("Missing Authorization header.");
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new Error("Invalid Authorization header format.");
  }

  const { payload } = await jwtVerify(token, getDesktopTokenKey(), {
    audience: DESKTOP_TOKEN_AUDIENCE,
    issuer: DESKTOP_TOKEN_ISSUER,
  });

  return parseClaims(payload);
}

export function buildDesktopVerificationUrl(requestUrl: URL, deviceCode: string): string {
  const url = new URL("/desktop/link", requestUrl.origin);
  url.searchParams.set("code", deviceCode);
  return url.toString();
}
