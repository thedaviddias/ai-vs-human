import type { Breadcrumb, EventHint } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

// We test the exported config objects — no Sentry SDK needed at runtime
import {
  clientSentryOptions,
  DENY_URLS,
  edgeSentryOptions,
  IGNORED_ERRORS,
  serverSentryOptions,
  sharedSentryOptions,
} from "../sentry";

/** Extract the event type accepted by sharedSentryOptions.beforeSend */
type SentryErrorEvent = Parameters<NonNullable<typeof sharedSentryOptions.beforeSend>>[0];

describe("IGNORED_ERRORS", () => {
  it("is a non-empty array", () => {
    expect(IGNORED_ERRORS.length).toBeGreaterThan(0);
  });

  it("includes ResizeObserver errors", () => {
    expect(IGNORED_ERRORS).toContain("ResizeObserver loop limit exceeded");
  });

  it("includes network errors", () => {
    expect(IGNORED_ERRORS).toContain("Failed to fetch");
    expect(IGNORED_ERRORS).toContain("NetworkError");
  });

  it("includes abort errors", () => {
    expect(IGNORED_ERRORS).toContain("AbortError");
  });

  it("includes regex patterns for chunk load errors", () => {
    const regexPatterns = IGNORED_ERRORS.filter((e) => e instanceof RegExp);
    expect(regexPatterns.length).toBeGreaterThan(0);
  });
});

describe("DENY_URLS", () => {
  it("is a non-empty array", () => {
    expect(DENY_URLS.length).toBeGreaterThan(0);
  });

  it("blocks chrome extensions", () => {
    const chromeRegex = DENY_URLS.find(
      (u) => u instanceof RegExp && u.source.includes("chrome-extension")
    );
    expect(chromeRegex).toBeDefined();
    expect((chromeRegex as RegExp).test("chrome-extension://abc/content.js")).toBe(true);
  });

  it("blocks plausible analytics", () => {
    const plausibleRegex = DENY_URLS.find(
      (u) => u instanceof RegExp && u.source.includes("plausible")
    );
    expect(plausibleRegex).toBeDefined();
  });
});

describe("sharedSentryOptions.beforeSend", () => {
  const { beforeSend } = sharedSentryOptions;

  it("returns event in production by default", () => {
    // In test env, NODE_ENV is "test", not "development"
    // so beforeSend should pass through when no filter matches
    const event: SentryErrorEvent = { event_id: "abc", type: undefined };
    const result = beforeSend(event, {} as EventHint);
    // In test mode, isDevelopment is false, so it should return the event
    expect(result).toBe(event);
  });

  it("filters out browser extension errors", () => {
    const event: SentryErrorEvent = {
      event_id: "abc",
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value: "extension error",
            stacktrace: {
              frames: [{ filename: "chrome-extension://xyz/content.js" }],
            },
          },
        ],
      },
    };

    const result = beforeSend(event, {} as EventHint);
    expect(result).toBeNull();
  });

  it("filters out moz-extension errors", () => {
    const event: SentryErrorEvent = {
      event_id: "abc",
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value: "ff error",
            stacktrace: {
              frames: [{ filename: "moz-extension://abc/script.js" }],
            },
          },
        ],
      },
    };

    expect(beforeSend(event, {} as EventHint)).toBeNull();
  });

  it("filters out errors with empty stack and no message", () => {
    const error = new Error("");
    error.stack = "Error";

    const event: SentryErrorEvent = { event_id: "abc", type: undefined };
    const hint: EventHint = { originalException: error };

    expect(beforeSend(event, hint)).toBeNull();
  });

  it("passes through normal errors", () => {
    const error = new Error("Something broke");
    const event: SentryErrorEvent = { event_id: "abc", type: undefined };
    const hint: EventHint = { originalException: error };

    expect(beforeSend(event, hint)).toBe(event);
  });
});

describe("sharedSentryOptions.beforeBreadcrumb", () => {
  const { beforeBreadcrumb } = sharedSentryOptions;

  it("filters out console.log breadcrumbs", () => {
    const breadcrumb: Breadcrumb = { category: "console", level: "log" };
    expect(beforeBreadcrumb(breadcrumb)).toBeNull();
  });

  it("keeps console.error breadcrumbs", () => {
    const breadcrumb: Breadcrumb = { category: "console", level: "error" };
    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });

  it("filters out plausible fetch breadcrumbs", () => {
    const breadcrumb: Breadcrumb = {
      category: "fetch",
      data: { url: "https://plausible.io/api/event" },
    };
    expect(beforeBreadcrumb(breadcrumb)).toBeNull();
  });

  it("keeps normal fetch breadcrumbs", () => {
    const breadcrumb: Breadcrumb = {
      category: "fetch",
      data: { url: "https://api.example.com/data" },
    };
    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });

  it("keeps non-fetch/console breadcrumbs", () => {
    const breadcrumb: Breadcrumb = { category: "navigation" };
    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });
});

describe("client/server/edge options", () => {
  it("clientSentryOptions includes tracePropagationTargets", () => {
    expect(clientSentryOptions.tracePropagationTargets).toBeDefined();
    expect(clientSentryOptions.tracePropagationTargets!.length).toBeGreaterThan(0);
  });

  it("edgeSentryOptions has lower maxBreadcrumbs than shared", () => {
    expect(edgeSentryOptions.maxBreadcrumbs).toBe(10);
    expect(sharedSentryOptions.maxBreadcrumbs).toBe(20);
  });

  it("serverSentryOptions inherits shared config", () => {
    expect(serverSentryOptions.sampleRate).toBe(sharedSentryOptions.sampleRate);
    expect(serverSentryOptions.tracesSampleRate).toBe(sharedSentryOptions.tracesSampleRate);
  });
});
