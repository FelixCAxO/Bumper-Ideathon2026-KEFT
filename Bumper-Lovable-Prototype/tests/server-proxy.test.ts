import { afterEach, describe, expect, it, vi } from "vitest";
import server from "../src/server";

const ORIGINAL_PROCESS_ENV = { ...process.env };

const env = {
  BACKEND_API_BASE_URL: "https://backend.example/base",
  DEMO_TRIGGER_KEY: "server-demo-secret",
  DEMO_API_KEY: "server-admin-secret",
};

const proxiedJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-backend": "proxied" },
  });

const asRequest = (input: unknown): Request => {
  if (!(input instanceof Request)) {
    throw new Error("Expected proxy to call fetch with a Request");
  }
  return input;
};

describe("server API proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_PROCESS_ENV };
  });

  it("proxies /api reads to BACKEND_API_BASE_URL without adding authorization", async () => {
    const fetchMock = vi.fn(async () => proxiedJson({ childId: "child_maya", alerts: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await server.fetch(
      new Request("https://frontend.example/api/alerts/child_maya?limit=50", {
        headers: { accept: "application/json" },
      }),
      env,
      {},
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-backend")).toBe("proxied");
    await expect(response.json()).resolves.toEqual({ childId: "child_maya", alerts: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const proxied = asRequest(fetchMock.mock.calls[0][0]);
    expect(proxied.url).toBe("https://backend.example/base/api/alerts/child_maya?limit=50");
    expect(proxied.method).toBe("GET");
    expect(proxied.headers.has("authorization")).toBe(false);
  });

  it("injects DEMO_TRIGGER_KEY for demo preset mutations and strips browser authorization", async () => {
    const fetchMock = vi.fn(async () => proxiedJson({ id: "alert-1" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const response = await server.fetch(
      new Request("https://frontend.example/api/demo/events/gift_scam", {
        method: "POST",
        headers: {
          authorization: "Bearer browser-should-not-win",
          "content-type": "application/json",
        },
        body: JSON.stringify({ childId: "child_maya" }),
      }),
      env,
      {},
    );

    expect(response.status).toBe(201);
    const proxied = asRequest(fetchMock.mock.calls[0][0]);
    expect(proxied.url).toBe("https://backend.example/base/api/demo/events/gift_scam");
    expect(proxied.headers.get("authorization")).toBe("Bearer server-demo-secret");
    expect(await proxied.text()).toBe(JSON.stringify({ childId: "child_maya" }));
  });

  it("injects DEMO_API_KEY for admin alert reset mutations", async () => {
    const fetchMock = vi.fn(async () => proxiedJson({ childId: "child_maya", deletedCount: 2 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await server.fetch(
      new Request("https://frontend.example/api/alerts/child_maya/reset", {
        method: "POST",
      }),
      env,
      {},
    );

    expect(response.status).toBe(200);
    const proxied = asRequest(fetchMock.mock.calls[0][0]);
    expect(proxied.url).toBe("https://backend.example/base/api/alerts/child_maya/reset");
    expect(proxied.headers.get("authorization")).toBe("Bearer server-admin-secret");
  });

  it("returns a JSON configuration error when the runtime env object is unavailable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.BACKEND_API_BASE_URL;

    const response = await server.fetch(
      new Request("https://frontend.example/api/alerts/child_alex"),
      undefined,
      {},
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: "BACKEND_API_BASE_URL is not configured.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses server process env values when Vite dev SSR does not pass a runtime env object", async () => {
    const fetchMock = vi.fn(async () => proxiedJson({ childId: "child_alex", alerts: [] }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.BACKEND_API_BASE_URL = "https://backend.example/dev";
    process.env.DEMO_API_KEY = "process-admin-secret";

    const response = await server.fetch(
      new Request("https://frontend.example/api/alerts/child_alex/reset", {
        method: "POST",
      }),
      undefined,
      {},
    );

    expect(response.status).toBe(200);
    const proxied = asRequest(fetchMock.mock.calls[0][0]);
    expect(proxied.url).toBe("https://backend.example/dev/api/alerts/child_alex/reset");
    expect(proxied.headers.get("authorization")).toBe("Bearer process-admin-secret");
  });
});
