import { describe, expect, it } from "vitest";
import {
  buildDashboardActionState,
  dashboardActionSummary,
  type DashboardAction,
  type DashboardFlowChild,
} from "../src/lib/dashboard-flow";
import type { Alert } from "../src/lib/alerts";

const child = (overrides: Partial<DashboardFlowChild> = {}): DashboardFlowChild => ({
  id: "child_maya",
  displayName: "Maya",
  currentGameLabel: "Fortnite",
  screenMinutes: 90,
  alertCount: 2,
  riskLevel: "High",
  ...overrides,
});

const alert = (overrides: Partial<Alert> = {}): Alert => ({
  id: "alert-1",
  publicId: "alert-1",
  childId: "child_maya",
  child: "Maya",
  platform: "Fortnite",
  event: "Unknown party invite",
  eventType: "unknown_party_invite",
  label: "Maya: unknown party invite",
  description: "Fortnite: unknown party invite",
  riskScore: 72,
  riskLevel: "High",
  reason: "Unknown player invited Maya to a private party.",
  parentAction: "Ask Maya if she knows this player.",
  signals: ["unknown_party_invite"],
  date: "May 13",
  createdAt: "2026-05-13T08:45:00.000Z",
  isHandled: false,
  isParentVisible: true,
  ...overrides,
});

const baseAction: DashboardAction = { type: "section", id: "dashboard", label: "Dashboard" };

describe("dashboard flow action state", () => {
  it("summarizes the clicked child from backend-driven game and alert state", () => {
    const state = buildDashboardActionState(
      { type: "child", id: "child_maya", label: "Open Maya" },
      {
        children: [child()],
        alerts: [alert()],
        lastUpdatedAt: "2026-05-13T08:45:00.000Z",
      },
    );

    expect(state.title).toBe("Maya");
    expect(state.status).toBe("Fortnite now, 2 alerts");
    expect(state.detail).toContain("High risk");
    expect(state.detail).toContain("1 recent alert");
    expect(state.detail).toContain("1h 30m screen time today");
  });

  it("keeps metric and section buttons tied to the current aggregate flow", () => {
    const alerts = [
      alert(),
      alert({
        id: "alert-2",
        publicId: "alert-2",
        childId: "child_alex",
        child: "Alex",
        riskLevel: "Medium",
        eventType: "private_call_invite",
        signals: ["private_call_invite"],
      }),
    ];

    expect(
      dashboardActionSummary(
        { type: "metric", id: "alerts", label: "New Alerts" },
        { children: [child(), child({ id: "child_alex", displayName: "Alex" })], alerts },
      ),
    ).toBe("2 active alerts across 2 kids");

    expect(
      dashboardActionSummary(
        { type: "section", id: "conversation-starters", label: "Conversation Starters" },
        { children: [child()], alerts },
      ),
    ).toBe("2 conversation starters ready");
  });

  it("falls back to a calm synced state when the backend has no visible alerts", () => {
    const state = buildDashboardActionState(baseAction, {
      children: [child({ alertCount: 0, riskLevel: null })],
      alerts: [],
    });

    expect(state.title).toBe("Dashboard");
    expect(state.status).toBe("Dashboard synced");
    expect(state.detail).toBe("No active alerts. Maya is currently playing Fortnite.");
  });
});
