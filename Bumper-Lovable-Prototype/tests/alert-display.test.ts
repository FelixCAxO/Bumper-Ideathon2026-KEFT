import { describe, expect, it } from "vitest";
import { parentFacingAlertDetail, parentFacingAlertTitle } from "../src/lib/alert-display";
import type { Alert } from "../src/lib/alerts";

const baseAlert: Alert = {
  id: "alert-1",
  publicId: "alert-1",
  childId: "child_jordan",
  child: "Jordan",
  platform: "Apex Legends",
  event: "Jordan: Apex Legends rapid repeat messages",
  eventType: "unknown_messages",
  presetId: "rapid_messages",
  label: "Jordan: Apex Legends rapid repeat messages",
  description: "Apex Legends: unknown messages (20 messages in 9 minutes)",
  riskScore: 62,
  riskLevel: "Medium",
  reason: "Repeated messages from an unknown account.",
  parentAction: "Ask Jordan whether they know this player.",
  signals: ["high_frequency"],
  date: "2h ago",
  createdAt: "2026-05-12T12:00:00.000Z",
  isHandled: false,
  isParentVisible: true,
};

describe("parent-facing alert display copy", () => {
  it("shows the actual alert description instead of the child-prefixed preset label", () => {
    expect(parentFacingAlertTitle(baseAlert)).toBe(
      "Apex Legends: unknown messages (20 messages in 9 minutes)",
    );
  });

  it("falls back to an unprefixed event when the backend omits a description", () => {
    expect(parentFacingAlertTitle({ ...baseAlert, description: undefined })).toBe(
      "Apex Legends rapid repeat messages",
    );
  });

  it("keeps supporting detail separate from the primary alert title", () => {
    expect(parentFacingAlertDetail(baseAlert)).toBe("Repeated messages from an unknown account.");
  });
});
