import { afterEach, describe, expect, it, vi } from "vitest";

// Mock @sentry/nextjs before importing logger
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { logger } from "../logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger.error", () => {
  it("logs to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("test error");

    logger.error("Something failed", err);

    expect(spy).toHaveBeenCalledWith("Something failed", err);
  });

  it("captures Error instances via Sentry.captureException", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("db timeout");

    logger.error("DB call failed", err, { query: "SELECT 1" });

    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      extra: { message: "DB call failed", query: "SELECT 1" },
    });
  });

  it("captures non-Error values via Sentry.captureMessage", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("Unexpected value", "string-error", { foo: "bar" });

    expect(Sentry.captureMessage).toHaveBeenCalledWith("Unexpected value", {
      level: "error",
      extra: { originalError: "string-error", foo: "bar" },
    });
  });

  it("captures message when error is undefined", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("Something went wrong");

    expect(Sentry.captureMessage).toHaveBeenCalledWith("Something went wrong", {
      level: "error",
      extra: { originalError: undefined },
    });
  });
});

describe("logger.warn", () => {
  it("logs to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logger.warn("Rate limit approaching", { remaining: 5 });

    expect(spy).toHaveBeenCalledWith("Rate limit approaching", { remaining: 5 });
  });

  it("adds a Sentry breadcrumb with warning level", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    logger.warn("Slow query", { duration: 5000 });

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: "Slow query",
      level: "warning",
      data: { duration: 5000 },
    });
  });
});

describe("logger.info", () => {
  it("logs to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("Sync started", { repo: "test/repo" });

    expect(spy).toHaveBeenCalledWith("Sync started", { repo: "test/repo" });
  });

  it("adds a Sentry breadcrumb with info level", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("User authenticated");

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: "User authenticated",
      level: "info",
      data: undefined,
    });
  });
});
