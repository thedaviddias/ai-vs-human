import { describe, expect, it } from "vitest";
import { resolvePrivateRepoCardMode } from "../privateRepoCardMode";

describe("resolvePrivateRepoCardMode", () => {
  it("returns not_linked when private data is not available", () => {
    expect(
      resolvePrivateRepoCardMode({
        hasPrivateData: false,
        syncStatus: "idle",
      })
    ).toBe("not_linked");

    expect(
      resolvePrivateRepoCardMode({
        hasPrivateData: false,
        syncStatus: "error",
      })
    ).toBe("not_linked");
  });

  it("returns syncing whenever sync is in progress", () => {
    expect(
      resolvePrivateRepoCardMode({
        hasPrivateData: false,
        syncStatus: "syncing",
      })
    ).toBe("syncing");

    expect(
      resolvePrivateRepoCardMode({
        hasPrivateData: true,
        syncStatus: "syncing",
      })
    ).toBe("syncing");
  });

  it("returns linked_compact for linked and healthy states", () => {
    expect(
      resolvePrivateRepoCardMode({
        hasPrivateData: true,
        syncStatus: "synced",
      })
    ).toBe("linked_compact");

    expect(
      resolvePrivateRepoCardMode({
        hasPrivateData: true,
        syncStatus: "idle",
      })
    ).toBe("linked_compact");
  });

  it("returns linked_expanded when linked state has errors", () => {
    expect(
      resolvePrivateRepoCardMode({
        hasPrivateData: true,
        syncStatus: "error",
      })
    ).toBe("linked_expanded");

    expect(
      resolvePrivateRepoCardMode({
        hasPrivateData: true,
        syncStatus: "synced",
        syncError: "Network timeout",
      })
    ).toBe("linked_expanded");
  });
});
