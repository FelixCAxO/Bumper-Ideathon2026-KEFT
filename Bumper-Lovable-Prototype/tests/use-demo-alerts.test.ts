import { describe, expect, it, vi } from "vitest";
import {
  buildDashboardsByChildId,
  buildDemoAlertStateFromSnapshots,
} from "../src/hooks/use-demo-alerts";
import type { DemoDashboardResponse } from "../src/lib/demo-client";
import type { Alert } from "../src/lib/alerts";

const alert: Alert = {
  id: 1,
  child: "Alex",
  platform: "Steam",
  event: "Unknown contact sent a message",
  riskLevel: "High",
  reason: "New contact without shared context.",
  parentAction: "Ask who this person is.",
  signals: ["new_contact"],
  date: "May 12, 10:30 AM",
  createdAt: "2026-05-12T10:30:00.000Z",
  isHandled: false,
  isParentVisible: true,
};

const snapshot = (alerts: Alert[]): DemoDashboardResponse => ({
  childId: "alex",
  alerts,
  summary: {
    overallRisk: alerts.some((entry) => entry.riskLevel === "High") ? "High" : "Low",
    weeklySummary: {
      newContacts: alerts.length,
      highRiskPatterns: alerts.filter((entry) => entry.riskLevel === "High").length,
      moveToOtherAppRequests: 0,
      personalInfoLeaks: 0,
    },
  },
  generatedAt: "2026-05-12T12:00:00.000Z",
});

describe("buildDemoAlertStateFromSnapshots", () => {
  it("treats latest backend snapshots as authoritative and summarizes the final alerts", () => {
    const previousAlerts = [alert, { ...alert, id: 2, child: "Maya" }];
    const nextState = buildDemoAlertStateFromSnapshots(previousAlerts, [snapshot([alert])], {
      now: new Date("2026-05-12T12:00:00.000Z"),
    });

    expect(nextState.alerts).toEqual([alert]);
    expect(nextState.summary.weeklySummary.newContacts).toBe(1);
    expect(nextState.summary.weeklySummary.highRiskPatterns).toBe(1);
  });
});

describe("buildDashboardsByChildId", () => {
  it("preserves each child's dashboard snapshot for live game status display", () => {
    const dashboards = buildDashboardsByChildId([
      {
        ...snapshot([]),
        childId: "child_alex",
        gameStatus: {
          currentGame: { id: "roblox", label: "Roblox", rating: "ESRB E10+" },
          availableGames: [],
        },
      },
      {
        ...snapshot([]),
        childId: "child_maya",
        gameStatus: {
          currentGame: { id: "fortnite", label: "Fortnite", rating: "ESRB T" },
          availableGames: [],
        },
      },
    ]);

    expect(dashboards.child_alex?.gameStatus?.currentGame.label).toBe("Roblox");
    expect(dashboards.child_maya?.gameStatus?.currentGame.label).toBe("Fortnite");
  });
});

describe("loadDemoAlertSnapshots", () => {
  it("uses dashboard snapshots only by default to keep child refreshes to one backend request each", async () => {
    const module = await import("../src/hooks/use-demo-alerts");
    const loadDemoAlertSnapshots = (
      module as {
        loadDemoAlertSnapshots?: (
          childIds: string[],
          client: {
            getDashboard: (childId: string) => Promise<DemoDashboardResponse>;
            getAlerts: (childId: string) => Promise<{
              childId: string;
              alerts: Array<{
                id: string | number;
                childId: string;
                label: string;
                presetId?: string;
                signals: Alert["signals"];
                date: string;
                createdAt: string;
                riskLevel: Alert["riskLevel"];
                riskScore: number;
                reason: string;
                parentAction: string;
                isParentVisible: boolean;
              }>;
              generatedAt: string;
            }>;
          },
        ) => Promise<DemoDashboardResponse[]>;
      }
    ).loadDemoAlertSnapshots;

    expect(loadDemoAlertSnapshots).toBeTypeOf("function");

    const recentAlert = {
      id: "recent-alert",
      childId: "child_maya",
      label: "Maya: recent dashboard alert",
      signals: ["new_contact"] as const,
      date: "May 12",
      createdAt: "2026-05-12T12:00:00.000Z",
      riskLevel: "Medium" as const,
      riskScore: 62,
      reason: "Recent dashboard alert.",
      parentAction: "Check in.",
      isParentVisible: true,
    };
    const getDashboard = vi.fn(async (childId: string) => ({
      ...snapshot([]),
      childId,
      recentAlerts: [recentAlert],
    }));
    const getAlerts = vi.fn(async (childId: string) => ({
      childId,
      alerts: [recentAlert],
      generatedAt: "2026-05-12T12:00:00.000Z",
    }));

    const snapshots = await loadDemoAlertSnapshots!(["child_maya"], {
      getDashboard,
      getAlerts,
    });
    const nextState = buildDemoAlertStateFromSnapshots([], snapshots, {
      now: new Date("2026-05-12T12:00:00.000Z"),
    });

    expect(getDashboard).toHaveBeenCalledWith("child_maya");
    expect(getAlerts).not.toHaveBeenCalled();
    expect(nextState.alerts.map((entry) => entry.id)).toEqual(["recent-alert"]);
  });

  it("can still fetch the full alert feed when a caller needs complete history", async () => {
    const module = await import("../src/hooks/use-demo-alerts");
    const loadDemoAlertSnapshots = (
      module as {
        loadDemoAlertSnapshots?: (
          childIds: string[],
          client: {
            getDashboard: (childId: string) => Promise<DemoDashboardResponse>;
            getAlerts: (childId: string) => Promise<{
              childId: string;
              alerts: Array<{
                id: string | number;
                childId: string;
                label: string;
                presetId?: string;
                signals: Alert["signals"];
                date: string;
                createdAt: string;
                riskLevel: Alert["riskLevel"];
                riskScore: number;
                reason: string;
                parentAction: string;
                isParentVisible: boolean;
              }>;
              generatedAt: string;
            }>;
          },
          options: { includeFullAlertFeed: true },
        ) => Promise<DemoDashboardResponse[]>;
      }
    ).loadDemoAlertSnapshots;

    const recentOnly = {
      id: "recent-only",
      childId: "child_maya",
      label: "Maya: recent dashboard alert",
      signals: ["new_contact"] as const,
      date: "May 12",
      createdAt: "2026-05-12T12:00:00.000Z",
      riskLevel: "Medium" as const,
      riskScore: 62,
      reason: "Recent dashboard alert.",
      parentAction: "Check in.",
      isParentVisible: true,
    };
    const fullFeedOnly = {
      ...recentOnly,
      id: "full-feed-only",
      label: "Maya: older full-feed alert",
      createdAt: "2026-05-11T12:00:00.000Z",
    };
    const getDashboard = vi.fn(async (childId: string) => ({
      ...snapshot([]),
      childId,
      recentAlerts: [recentOnly],
    }));
    const getAlerts = vi.fn(async (childId: string) => ({
      childId,
      alerts: [recentOnly, fullFeedOnly],
      generatedAt: "2026-05-12T12:00:00.000Z",
    }));

    const snapshots = await loadDemoAlertSnapshots!(
      ["child_maya"],
      {
        getDashboard,
        getAlerts,
      },
      { includeFullAlertFeed: true },
    );
    const nextState = buildDemoAlertStateFromSnapshots([], snapshots, {
      now: new Date("2026-05-12T12:00:00.000Z"),
    });

    expect(getDashboard).toHaveBeenCalledWith("child_maya");
    expect(getAlerts).toHaveBeenCalledWith("child_maya");
    expect(nextState.alerts.map((entry) => entry.id)).toEqual(["recent-only", "full-feed-only"]);
  });
});
