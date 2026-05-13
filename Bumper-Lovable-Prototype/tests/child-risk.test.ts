import { describe, expect, it } from "vitest";
import { buildChildCardsFromAlerts } from "../src/lib/child-risk";
import type { Alert } from "../src/lib/alerts";
import { children } from "../src/lib/mock-data";

const alertFor = (overrides: Partial<Alert>): Alert => ({
  id: 1,
  child: "Alex",
  platform: "Steam",
  event: "Unknown contact sent a message",
  riskLevel: "Low",
  reason: "New contact without shared context.",
  parentAction: "Ask who this person is.",
  signals: ["new_contact"],
  date: "May 12, 10:30 AM",
  createdAt: "2026-05-12T10:30:00.000Z",
  isHandled: false,
  isParentVisible: true,
  ...overrides,
});

describe("buildChildCardsFromAlerts", () => {
  it("derives each child risk card from the highest active visible alert for that child", () => {
    const cards = buildChildCardsFromAlerts(children, [
      alertFor({ id: 1, child: "Alex", riskLevel: "Medium", platform: "Steam" }),
      alertFor({
        id: 2,
        child: "Alex",
        childId: "child_alex",
        riskLevel: "High",
        platform: "Discord",
        date: "Today",
      }),
      alertFor({ id: 3, child: "Maya", riskLevel: "High", isHandled: true }),
      alertFor({ id: 4, child: "Maya", riskLevel: "Low", platform: "Roblox" }),
    ]);

    expect(cards.find((child) => child.id === "child_alex")).toMatchObject({
      risk: "high",
      riskScore: 90,
      platform: "Discord",
      lastActive: "Today",
    });
    expect(cards.find((child) => child.id === "child_maya")).toMatchObject({
      risk: "low",
      riskScore: 15,
      platform: "Roblox",
    });
    expect(cards.find((child) => child.id === "child_jordan")).toMatchObject({
      risk: "low",
      riskScore: 10,
      lastActive: "No signals yet",
    });
  });
});
