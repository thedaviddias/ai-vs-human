import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Mount all better-auth endpoints (sign-in, sign-out, callback, session, etc.)
authComponent.registerRoutes(http, createAuth);

// ---------------------------------------------------------------------------
// CORS helpers — restrict cross-origin access to known sister apps
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  "https://stackmatch.dev",
  "http://localhost:3000",
  "http://localhost:3100",
];

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// ---------------------------------------------------------------------------
// Public API: profile existence check
// Used by StackMatch to conditionally render the cross-app profile link.
// Single indexed lookup on profiles.by_owner — extremely fast.
// ---------------------------------------------------------------------------
http.route({
  path: "/api/profile-exists",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    const owner = url.searchParams.get("owner");

    if (!owner) {
      return new Response(JSON.stringify({ exists: false }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const profile = await ctx.runQuery(api.queries.users.getProfile, { owner });

    return new Response(JSON.stringify({ exists: profile !== null }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        ...corsHeaders(origin),
      },
    });
  }),
});

// CORS preflight
http.route({
  path: "/api/profile-exists",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin")),
    });
  }),
});

export default http;
