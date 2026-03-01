import { describe, expect, it, vi } from "vitest";
import { requirePrivateDataAccess } from "../userHelpers";

// ─── Mocks ─────────────────────────────────────────────────────────────

vi.mock("../../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

vi.mock("../../lib/authHelpers", () => ({
  resolveGitHubLogin: vi.fn(),
}));

function makeMockCtx(profile: Record<string, unknown> | null = null) {
  return {
    db: {
      query: vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        unique: vi.fn().mockResolvedValue(profile),
      }),
    },
  } as unknown as Parameters<typeof requirePrivateDataAccess>[0];
}

// ─── requirePrivateDataAccess ────────────────────────────────────────

describe("requirePrivateDataAccess", () => {
  it("allows access if the profile has showPrivateDataPublicly set to true", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: true });

    // Should resolve without throwing
    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).resolves.toBe(true);
  });

  it("allows access if the profile showPrivateDataPublicly is undefined (default public)", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: undefined });

    // Should resolve without throwing
    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).resolves.toBe(true);
  });

  it("throws Unauthorized if the user is not signed in and profile is private", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: false });

    const { authComponent } = await import("../../auth");
    vi.mocked(authComponent.getAuthUser).mockRejectedValueOnce(new Error("Unauthenticated"));

    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).rejects.toThrowError(
      "Unauthorized: Private data is not public. Please sign in."
    );
  });

  it("throws Unauthorized if signed-in user does not match the requested profile", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: false });

    const { authComponent } = await import("../../auth");
    const { resolveGitHubLogin } = await import("../../lib/authHelpers");

    vi.mocked(authComponent.getAuthUser).mockResolvedValueOnce({
      _id: "user123",
    } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
    vi.mocked(resolveGitHubLogin).mockResolvedValueOnce("anotheruser");

    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).rejects.toThrowError(
      "Unauthorized: You do not have permission to view this private data."
    );
  });

  it("allows access if signed-in user matches the requested profile (case insensitive)", async () => {
    const ctx = makeMockCtx({ showPrivateDataPublicly: false });

    const { authComponent } = await import("../../auth");
    const { resolveGitHubLogin } = await import("../../lib/authHelpers");

    vi.mocked(authComponent.getAuthUser).mockResolvedValueOnce({
      _id: "user123",
    } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
    vi.mocked(resolveGitHubLogin).mockResolvedValueOnce("TheDavidDias");

    await expect(requirePrivateDataAccess(ctx, "thedaviddias")).resolves.toBe(true);
  });
});
