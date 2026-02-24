"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Global error boundary — catches errors in the root layout itself.
 *
 * Because the root layout is broken when this renders, we must provide
 * our own <html> and <body> tags. Styling is inline since CSS imports
 * may not be available.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Something went wrong</h2>
          <p style={{ marginTop: "0.75rem", color: "#a3a3a3", fontSize: "0.875rem" }}>
            A critical error occurred. Please try refreshing the page.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.5rem",
              backgroundColor: "#262626",
              color: "#fafafa",
              border: "1px solid #404040",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
