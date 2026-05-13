import { describe, expect, it } from "vitest";
import { buildAccountConnectionsSummary } from "../src/lib/account-connections";
import type { Alert } from "../src/lib/alerts";

const alert: Alert = {
  id: 1,
  child: "Alex",
  childId: "child_alex",
  platform: "Roblox",
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

describe("buildAccountConnectionsSummary", () => {
  it("summarizes connected apps and games without duplicate labels", () => {
    const summary = buildAccountConnectionsSummary(
      [
        { id: "child_alex", currentGameLabel: "Roblox" },
        { id: "child_maya", currentGameLabel: "Fortnite" },
        { id: "child_jordan", currentGameLabel: "Roblox" },
      ],
      [],
    );

    expect(summary.connectedCount).toBe(2);
    expect(summary.value).toBe("2 connected");
    expect(summary.connectionPreview).toBe("Roblox, Fortnite");
    expect(summary.alertBody).toBe("No account alerts need attention");
  });

  it("counts only visible, active account alerts that need attention", () => {
    const summary = buildAccountConnectionsSummary(
      [{ id: "child_alex", currentGameLabel: "Roblox" }],
      [
        alert,
        { ...alert, id: 2, riskLevel: "Medium" },
        { ...alert, id: 3, riskLevel: "Low", signals: ["high_frequency"] },
        { ...alert, id: 4, isHandled: true },
        { ...alert, id: 5, isParentVisible: false },
      ],
    );

    expect(summary.attentionCount).toBe(2);
    expect(summary.alertBody).toBe("2 account alerts need attention");
  });
});
