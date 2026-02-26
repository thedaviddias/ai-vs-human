import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Mount all better-auth endpoints (sign-in, sign-out, callback, session, etc.)
authComponent.registerRoutes(http, createAuth);

export default http;
