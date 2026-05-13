import { describe, expect, it } from "vitest";
import { getAlertPublicSignalId, toParentFeedSignals } from "../src/lib/signal-feed";
import type { Alert } from "../src/lib/alerts";

const visibleAlert: Alert = {
  id: 7,
  child: "Alex",
  platform: "Steam",
  event: "Unknown Steam profile sent repeated messages",
  riskLevel: "High",
  reason: "A new contact moved quickly into frequent messaging.",
  parentAction: "Ask Alex who this person is before they keep chatting.",
  signals: ["new_contact", "move_to_other_app"],
  date: "May 12, 10:30 AM",
  createdAt: "2026-05-12T10:30:00.000Z",
  isHandled: false,
  isParentVisible: true,
};

describe("toParentFeedSignals", () => {
  it("returns no parent feed cards when there are no backend-visible alerts", () => {
    expect(toParentFeedSignals([])).toEqual([]);
  });

  it("maps backend-triggered visible alerts into parent feed cards", () => {
    expect(toParentFeedSignals([visibleAlert])).toEqual([
      {
        id: "alex-7",
        childName: "Alex",
        platform: "Steam",
        risk: "high",
        pattern: "Unknown Steam profile sent repeated messages",
        description: "A new contact moved quickly into frequent messaging.",
        recommendation: "Ask Alex who this person is before they keep chatting.",
        contact: "Steam",
        timestamp: "May 12, 10:30 AM",
        type: "platform-hop",
      },
    ]);
  });

  it("uses public API alert IDs when available", () => {
    const apiAlert = {
      ...visibleAlert,
      publicId: "child_maya-1",
      childId: "child_maya",
      child: "Maya",
    };

    expect(getAlertPublicSignalId(apiAlert)).toBe("child_maya-1");
    expect(toParentFeedSignals([apiAlert])[0].id).toBe("child_maya-1");
  });

  it("classifies signal cards by the highest-priority alert signal", () => {
    expect(toParentFeedSignals([{ ...visibleAlert, signals: ["personal_info"] }])[0].type).toBe(
      "personal-info",
    );
    expect(toParentFeedSignals([{ ...visibleAlert, signals: ["high_frequency"] }])[0].type).toBe(
      "high-frequency",
    );
    expect(toParentFeedSignals([{ ...visibleAlert, signals: ["late_night"] }])[0].type).toBe(
      "late-night",
    );
    expect(toParentFeedSignals([{ ...visibleAlert, signals: ["new_contact"] }])[0].type).toBe(
      "new-contact",
    );
  });

  it("omits handled alerts from active parent feed cards", () => {
    expect(toParentFeedSignals([{ ...visibleAlert, isHandled: true }])).toEqual([]);
  });

  it("limits dashboard previews without adding static fallback signals", () => {
    const secondAlert = { ...visibleAlert, id: 8, riskLevel: "Medium" as const };
    const thirdAlert = { ...visibleAlert, id: 9, riskLevel: "Low" as const };

    expect(toParentFeedSignals([visibleAlert, secondAlert, thirdAlert], { limit: 2 })).toHaveLength(
      2,
    );
  });

  it("keeps feed IDs unique when multiple children have same worker alert ID", () => {
    const mayaAlert = { ...visibleAlert, id: 1, child: "Maya" };
    const samAlert = { ...visibleAlert, id: 1, child: "Sam" };

    expect(toParentFeedSignals([mayaAlert, samAlert]).map((signal) => signal.id)).toEqual([
      "maya-1",
      "sam-1",
    ]);
  });
});
