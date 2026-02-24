import { afterEach, describe, expect, it, vi } from "vitest";
import { postJson } from "../postJson";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("postJson", () => {
  it("sends POST request with JSON body and content-type header", async () => {
    const payload = { owner: "facebook", name: "react" };
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    await postJson("/api/analyze/repo", payload);

    expect(mockFetch).toHaveBeenCalledWith("/api/analyze/repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("returns parsed JSON response on success", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ repoId: "123", status: "pending" }));

    const result = await postJson<{ repoId: string; status: string }>("/api/test", {});

    expect(result).toEqual({ repoId: "123", status: "pending" });
  });

  it("throws error with server error message when response has error field", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "owner and name are required" }, 400));

    await expect(postJson("/api/test", {})).rejects.toThrow("owner and name are required");
  });

  it("throws generic error when response is not JSON", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }));

    await expect(postJson("/api/test", {})).rejects.toThrow("Request failed with status 500");
  });

  it("throws generic error when response JSON has no error field", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "something" }, 422));

    await expect(postJson("/api/test", {})).rejects.toThrow("Request failed with status 422");
  });

  it("handles 201 as success", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ created: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await postJson<{ created: boolean }>("/api/test", {});
    expect(result).toEqual({ created: true });
  });

  it("propagates fetch network errors", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(postJson("/api/test", {})).rejects.toThrow("Failed to fetch");
  });
});
