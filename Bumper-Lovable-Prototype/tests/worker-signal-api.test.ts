import { afterEach, describe, expect, it, vi } from "vitest";
import server from "../src/server";

const ORIGINAL_PROCESS_ENV = { ...process.env };

const env = {
  BACKEND_API_BASE_URL: "https://backend.example",
  DEMO_TRIGGER_KEY: "worker-secret",
};

const proxiedJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const asRequest = (input: unknown): Request => {
  if (!(input instanceof Request)) {
    throw new Error("Expected proxy to call fetch with a Request");
  }
  return input;
};

const workerSignalBody = {
  childId: "child_maya",
  eventId: "worker-event-1",
  label: "Maya: unknown Roblox account shared an external link",
  description: "Unknown Roblox account shared an external link",
  platform: "Roblox",
  eventType: "unknown_link",
  riskLevel: "Medium",
  riskScore: 68,
  reason: "A new contact sent a link before there was any trusted context.",
  parentAction: "Ask Maya whether she knows this person before opening the link.",
  signals: ["new_contact"],
  contactHandleHash: "contact_maya_unknown_link",
  date: "May 12, 16:45",
  createdAt: "2026-05-12T16:45:00.000Z",
  isParentVisible: true,
};

describe("Cloudflare Worker signal proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_PROCESS_ENV };
  });

  it("forwards worker signals to the backend with the server-side trigger key", async () => {
    const backendAlert = {
      id: "alert-1",
      childId: "child_maya",
      eventId: "worker-event-1",
      label: workerSignalBody.label,
      riskLevel: "Medium",
      isParentVisible: true,
    };
    const fetchMock = vi.fn(async () => proxiedJson(backendAlert, 201));
    vi.stubGlobal("fetch", fetchMock);

    const response = await server.fetch(
      new Request("https://frontend.example/api/worker/signals", {
        method: "POST",
        headers: {
          authorization: "Bearer browser-should-not-win",
          "content-type": "application/json",
          "Idempotency-Key": "worker-event-1",
        },
        body: JSON.stringify(workerSignalBody),
      }),
      env,
      {},
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(backendAlert);

    const proxied = asRequest(fetchMock.mock.calls[0][0]);
    expect(proxied.url).toBe("https://backend.example/api/worker/signals");
    expect(proxied.headers.get("authorization")).toBe("Bearer worker-secret");
    expect(proxied.headers.get("Idempotency-Key")).toBe("worker-event-1");
    expect(await proxied.json()).toEqual(workerSignalBody);
  });

  it("does not proxy worker signals when the server trigger key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.DEMO_TRIGGER_KEY;

    const response = await server.fetch(
      new Request("https://frontend.example/api/worker/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(workerSignalBody),
      }),
      { BACKEND_API_BASE_URL: "https://backend.example" },
      {},
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "DEMO_TRIGGER_KEY is not configured.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns backend idempotency and auth failures without local state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(proxiedJson({ error: "worker signal event id is required" }, 400))
      .mockResolvedValueOnce(proxiedJson({ id: "alert-1", eventId: "worker-event-2" }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const missingId = await server.fetch(
      new Request("https://frontend.example/api/worker/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...workerSignalBody, eventId: undefined }),
      }),
      env,
      {},
    );
    expect(missingId.status).toBe(400);

    const duplicate = await server.fetch(
      new Request("https://frontend.example/api/worker/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...workerSignalBody, eventId: "worker-event-2" }),
      }),
      env,
      {},
    );
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toEqual({
      id: "alert-1",
      eventId: "worker-event-2",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
