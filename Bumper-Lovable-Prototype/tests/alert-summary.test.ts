import { describe, expect, it } from "vitest";
import { buildAlertSummary } from "../src/lib/alert-summary";
import type { Alert } from "../src/lib/alerts";

const baseAlert: Alert = {
  id: 1,
  child: "Alex",
  platform: "Steam",
  event: "Unknown contact sent a message",
  riskLevel: "Medium",
  reason: "New contact without shared context.",
  parentAction: "Ask who this person is.",
  signals: ["new_contact"],
  date: "May 12, 10:30 AM",
  createdAt: "2026-05-12T10:30:00.000Z",
  isHandled: false,
  isParentVisible: true,
};

describe("buildAlertSummary", () => {
  it("counts only active alerts from the trailing seven days in weekly totals", () => {
    const now = new Date("2026-05-12T12:00:00.000Z");
    const alerts: Alert[] = [
      {
        ...baseAlert,
        id: 1,
        signals: ["new_contact", "move_to_other_app"],
        riskLevel: "High",
        createdAt: "2026-05-12T10:30:00.000Z",
      },
      {
        ...baseAlert,
        id: 2,
        signals: ["personal_info"],
        riskLevel: "Medium",
        createdAt: "2026-05-01T10:30:00.000Z",
      },
      {
        ...baseAlert,
        id: 3,
        signals: ["new_contact"],
        riskLevel: "High",
        createdAt: "2026-05-12T09:30:00.000Z",
        isHandled: true,
      },
    ];

    const summary = buildAlertSummary(alerts, { now });

    expect(summary.overallRisk).toBe("High");
    expect(summary.weeklySummary).toEqual({
      newContacts: 1,
      highRiskPatterns: 1,
      moveToOtherAppRequests: 1,
      personalInfoLeaks: 0,
    });
  });
});
