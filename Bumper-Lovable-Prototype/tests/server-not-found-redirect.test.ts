import { describe, expect, it, vi } from "vitest";

const serverEntryFetch = vi.fn();

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: serverEntryFetch,
  },
}));

const { default: server } = await import("../src/server");

describe("server SSR dashboard fallback", () => {
  it.each(["/feed", "/settings", "/transparency", "/child", "/unknown/path"])(
    "redirects removed app route %s to the dashboard after SSR 404",
    async (path) => {
      serverEntryFetch.mockResolvedValueOnce(
        new Response("<!doctype html><h1>Not found</h1>", {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

      const response = await server.fetch(new Request(`https://frontend.example${path}`), {}, {});

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/dashboard");
    },
  );

  it("does not redirect missing file-like asset requests", async () => {
    serverEntryFetch.mockResolvedValueOnce(
      new Response("not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );

    const response = await server.fetch(
      new Request("https://frontend.example/assets/missing.js"),
      {},
      {},
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });
});
