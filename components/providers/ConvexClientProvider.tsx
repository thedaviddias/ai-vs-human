"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Lazily initialize the Convex client.
 *
 * During Vercel's static prerendering step, NEXT_PUBLIC_CONVEX_URL is not
 * available. We provide a placeholder URL to ensure the provider exists,
 * preventing "Could not find Convex client" errors in the component tree.
 */
let convex: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient {
  if (convex) return convex;

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  // Fallback to avoid crash if env var is missing during build
  const effectiveUrl = url || "https://static-build-placeholder.convex.cloud";

  convex = new ConvexReactClient(effectiveUrl);
  return convex;
}

/**
 * Provides the Convex client with better-auth session forwarding.
 *
 * Uses `ConvexBetterAuthProvider` (instead of plain `ConvexProvider`)
 * so that the session token is automatically sent with every query
 * and mutation. Without this, `authComponent.getAuthUser(ctx)` throws
 * `ConvexError("Unauthenticated")` because Convex never receives the token.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = getConvexClient();

  return (
    <ConvexBetterAuthProvider client={client} authClient={authClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
