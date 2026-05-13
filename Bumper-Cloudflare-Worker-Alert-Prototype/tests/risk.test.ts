import { describe, expect, it } from "vitest";
import { scoreEvent } from "../src/risk";
import { DEFAULT_SETTINGS } from "../src/types";

describe("risk scoring", () => {
  it("classifies high-frequency unknown contact plus app-move signals as high risk", () => {
    const scored = scoreEvent({
      childId: "child_alex",
      platform: "Roblox",
      eventType: "unknown_messages",
      messageCount: 18,
      windowMinutes: 10,
      signals: ["new_contact", "high_frequency", "move_to_other_app"],
      description: "Unknown user asked to move to Discord"
    });

    expect(scored).toMatchObject({
      riskLevel: "High",
      parentAction: expect.stringMatching(/Talk to the child calmly/i)
    });
    expect(scored.riskScore).toBeGreaterThanOrEqual(70);
    expect(scored.reason).toContain("new contact");
    expect(scored.reason).toContain("high message frequency");
    expect(scored.reason).toContain("move conversation to another app");
  });

  it("keeps low-signal metadata as low risk with monitoring guidance", () => {
    const scored = scoreEvent({
      childId: "child_alex",
      platform: "Steam",
      eventType: "new_friend",
      signals: []
    });

    expect(scored).toEqual({
      riskScore: 20,
      riskLevel: "Low",
      reason: "new contact",
      parentAction: "No urgent action. Keep monitoring for repeated patterns."
    });
  });

  it("classifies explicit call invites from unknown contacts as high risk", () => {
    const scored = scoreEvent({
      childId: "child_alex",
      platform: "Discord",
      eventType: "call_invite",
      signals: ["voice_call", "new_contact"],
      messageCount: 2,
      windowMinutes: 30
    });

    expect(scored).toMatchObject({
      riskLevel: "High",
      reason: expect.stringContaining("private call invitation")
    });
    expect(scored.riskScore).toBeGreaterThanOrEqual(70);
  });

  it("adds gift/scam risk for lure indicators", () => {
    const scored = scoreEvent({
      childId: "child_alex",
      platform: "Roblox",
      eventType: "gift_scam",
      signals: ["robux"],
      messageCount: 3,
      windowMinutes: 20
    });

    expect(scored.riskLevel).toBe("Medium");
    expect(scored.riskScore).toBe(45);
    expect(scored.reason).toContain("gift/scam lure");
  });

  it("honors settings when scoring", () => {
    const scored = scoreEvent(
      {
        childId: "child_alex",
        platform: "Roblox",
        eventType: "new_friend",
        signals: ["new_contact"]
      },
      {
        ...DEFAULT_SETTINGS,
        newFriends: false
      }
    );

    expect(scored).toMatchObject({
      riskScore: 0,
      riskLevel: "Low",
      reason: "No strong risk pattern detected"
    });
  });

  it("suppresses call and gift-scam scoring through the existing settings families", () => {
    const callInvite = scoreEvent(
      {
        childId: "child_alex",
        platform: "Discord",
        eventType: "call_invite",
        signals: ["voice_call"]
      },
      {
        ...DEFAULT_SETTINGS,
        moveToOtherApp: false
      }
    );

    expect(callInvite.riskScore).toBe(0);
    expect(callInvite.reason).toBe("No strong risk pattern detected");

    const giftScam = scoreEvent(
      {
        childId: "child_alex",
        platform: "Roblox",
        eventType: "gift_scam",
        signals: ["gift_scam"]
      },
      {
        ...DEFAULT_SETTINGS,
        unknownMessages: false
      }
    );

    expect(giftScam.riskScore).toBe(0);
    expect(giftScam.reason).toBe("No strong risk pattern detected");
  });

  it("does not score platform moves from description when move-to-other-app alerts are disabled", () => {
    const scored = scoreEvent(
      {
        childId: "child_alex",
        platform: "Roblox",
        eventType: "unclassified",
        description: "Unknown player mentioned Discord"
      },
      {
        ...DEFAULT_SETTINGS,
        moveToOtherApp: false
      }
    );

    expect(scored.riskScore).toBe(0);
    expect(scored.reason).toBe("No strong risk pattern detected");
  });
});
