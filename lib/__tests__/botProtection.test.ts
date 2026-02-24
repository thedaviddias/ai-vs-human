import { afterEach, describe, expect, it, vi } from "vitest";

// Mock botid/server before importing
vi.mock("botid/server", () => ({
  checkBotId: vi.fn(),
}));

// Mock logger to prevent console noise
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { checkBotId } from "botid/server";
import { requireHumanRequest } from "../server/botProtection";

const mockCheckBotId = vi.mocked(checkBotId);

describe("requireHumanRequest", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("allows all requests when not on Vercel", async () => {
    delete process.env.VERCEL;

    const result = await requireHumanRequest();

    expect(result).toEqual({ allowed: true });
    expect(mockCheckBotId).not.toHaveBeenCalled();
  });

  it("allows human requests on Vercel", async () => {
    process.env.VERCEL = "1";
    mockCheckBotId.mockResolvedValueOnce({ isBot: false } as never);

    const result = await requireHumanRequest();

    expect(result).toEqual({ allowed: true });
    expect(mockCheckBotId).toHaveBeenCalled();
  });

  it("blocks bot requests on Vercel with 403", async () => {
    process.env.VERCEL = "1";
    mockCheckBotId.mockResolvedValueOnce({ isBot: true } as never);

    const result = await requireHumanRequest();

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      const body = await result.response.json();
      expect(result.response.status).toBe(403);
      expect(body.error).toBe("Access denied");
    }
  });

  it("returns 503 when BotID verification throws", async () => {
    process.env.VERCEL = "1";
    mockCheckBotId.mockRejectedValueOnce(new Error("OIDC unavailable"));

    const result = await requireHumanRequest();

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      const body = await result.response.json();
      expect(result.response.status).toBe(503);
      expect(body.error).toBe("Bot protection unavailable");
    }
  });
});
