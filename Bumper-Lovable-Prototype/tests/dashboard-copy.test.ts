import { describe, expect, it } from "vitest";
import { formatDashboardTopMessage } from "../src/lib/dashboard-copy";
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

describe("formatDashboardTopMessage", () => {
  it("uses the active high-risk count and pluralizes the dashboard message", () => {
    expect(formatDashboardTopMessage([])).toBe("Your kids are cruising safely.");
    expect(formatDashboardTopMessage([alert])).toBe("1 signal needs your attention.");
    expect(
      formatDashboardTopMessage([
        alert,
        { ...alert, id: 2, child: "Maya" },
        { ...alert, id: 3, isHandled: true },
      ]),
    ).toBe("2 signals need your attention.");
  });
});
