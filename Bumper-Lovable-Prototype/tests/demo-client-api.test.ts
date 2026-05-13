import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_CONTROL_PANEL_URL,
  alertSummaryToAlert,
  getAlerts,
  getDashboard,
  getDemoChildren,
  getDemoPollIntervalMs,
  getDemoPresets,
  triggerDemoPreset,
} from "../src/lib/demo-client";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("demo browser API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses same-origin /api URLs for browser reads by default", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ children: [], childId: "child_alex", presets: [], alerts: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getDemoChildren();
    await getDemoPresets("child_maya");
    await getDashboard("child_jordan");
    await getAlerts("child_alex");

    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual([
      "/api/demo/children",
      "/api/demo/presets?childId=child_maya",
      "/api/dashboard/child_jordan",
      "/api/alerts/child_alex",
    ]);
  });

  it("keeps the demo control panel URL configurable without a deployed private URL", () => {
    expect(DEMO_CONTROL_PANEL_URL).toBe("http://127.0.0.1:8787/demo");
  });

  it("keeps automatic polling modest enough for the backend daily request cap", () => {
    expect(getDemoPollIntervalMs()).toBeGreaterThanOrEqual(60_000);
  });

  it("triggers demo presets through the same-origin proxy without browser authorization", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        id: "alert-api-1",
        childId: "child_maya",
        label: "Maya: gift lure",
        description: "Gift lure",
        platform: "Roblox",
        eventType: "gift_scam",
        riskLevel: "High",
        riskScore: 90,
        reason: "Gift scam lure.",
        parentAction: "Talk with Maya.",
        signals: ["gift_scam"],
        date: "May 12",
        createdAt: "2026-05-12T12:00:00.000Z",
        isParentVisible: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await triggerDemoPreset("gift_scam", "child_maya");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/demo/events/gift_scam");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ childId: "child_maya" }),
    });
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });

  it("maps backend alert summary IDs directly when they are strings", () => {
    const alert = alertSummaryToAlert({
      id: "alert-string-id",
      childId: "child_maya",
      label: "Maya: unknown contact",
      presetId: "unknown_party_invite",
      signals: ["new_contact"],
      date: "May 12",
      createdAt: "2026-05-12T12:00:00.000Z",
      riskLevel: "Medium",
      riskScore: 62,
      reason: "Unknown contact.",
      parentAction: "Ask who this is.",
      isParentVisible: true,
    });

    expect(alert.id).toBe("alert-string-id");
    expect(alert.publicId).toBe("alert-string-id");
    expect(alert.event).toBe("Maya: unknown contact");
  });
});
