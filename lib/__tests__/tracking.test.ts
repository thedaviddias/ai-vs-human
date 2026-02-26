import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "../tracking";

describe("trackEvent", () => {
  let plausibleSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    plausibleSpy = vi.fn();
    vi.stubGlobal("window", { plausible: plausibleSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls window.plausible with event name and props", () => {
    trackEvent("search", { query: "react" });

    expect(plausibleSpy).toHaveBeenCalledWith("search", {
      props: { query: "react" },
    });
  });

  it("passes correct props for analyze_repo event", () => {
    trackEvent("analyze_repo", { owner: "facebook", repo: "react" });

    expect(plausibleSpy).toHaveBeenCalledWith("analyze_repo", {
      props: { owner: "facebook", repo: "react" },
    });
  });

  it("passes correct props for copy_card event", () => {
    trackEvent("copy_card", { label: "test-user", type: "user" });

    expect(plausibleSpy).toHaveBeenCalledWith("copy_card", {
      props: { label: "test-user", type: "user" },
    });
  });

  it("passes correct props for copy_embed event", () => {
    trackEvent("copy_embed", { format: "markdown" });

    expect(plausibleSpy).toHaveBeenCalledWith("copy_embed", {
      props: { format: "markdown" },
    });
  });

  it("passes correct props for leaderboard events", () => {
    trackEvent("leaderboard_view", { section: "developers" });
    trackEvent("leaderboard_sort_change", { section: "developers", sort: "stars" });
    trackEvent("leaderboard_metric_toggle", { section: "ai-tools", metric: "loc" });

    expect(plausibleSpy).toHaveBeenCalledWith("leaderboard_view", {
      props: { section: "developers" },
    });
    expect(plausibleSpy).toHaveBeenCalledWith("leaderboard_sort_change", {
      props: { section: "developers", sort: "stars" },
    });
    expect(plausibleSpy).toHaveBeenCalledWith("leaderboard_metric_toggle", {
      props: { section: "ai-tools", metric: "loc" },
    });
  });

  it("is a no-op when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);

    // Should not throw
    expect(() => trackEvent("search", { query: "test" })).not.toThrow();
  });

  it("is a no-op when window.plausible is not defined (dev mode)", () => {
    vi.stubGlobal("window", {});

    // Should not throw even without plausible script
    expect(() => trackEvent("resync", { owner: "test" })).not.toThrow();
  });
});
