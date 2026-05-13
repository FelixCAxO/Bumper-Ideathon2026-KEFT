import { describe, it, expect, beforeEach } from "vitest";
import { DEMO_CHILD_ID } from "../src/lib/alerts";
import {
  createDemoAlertFromPreset,
  DEMO_PRESETS,
  getDemoPreset,
  getDemoPresetsForChild,
} from "../src/lib/demo-presets";
import {
  getDemoAlerts,
  getDemoDashboard,
  resetDemoAlerts,
  triggerDemoPreset,
} from "../src/lib/demo-store";

describe("DEMO_PRESETS", () => {
  it("includes the six frontend technical sheet presets", () => {
    expect(DEMO_PRESETS.map((entry) => entry.id)).toEqual([
      "roblox_discord_move",
      "personal_info_request",
      "unknown_party_invite",
      "private_call_invite",
      "rapid_messages",
      "gift_scam",
    ]);
    expect(getDemoPreset("roblox_discord_move")?.signals).toContain("move_to_other_app");
    expect(getDemoPreset("personal_info_request")?.signals).toContain("personal_info");
    expect(getDemoPreset("unknown_party_invite")?.signals).toContain("new_contact");
    expect(getDemoPreset("private_call_invite")?.signals).toContain("private_call_invite");
  });

  it("scopes preset labels and quantitative variants to the selected child", () => {
    const presets = getDemoPresetsForChild("child_maya");

    expect(presets).toHaveLength(6);
    expect(presets.every((preset) => preset.label.startsWith("Maya:"))).toBe(true);
    expect(presets.find((preset) => preset.id === "gift_scam")?.description).toContain(
      "4 gifts in 18 minutes",
    );
    expect(presets.find((preset) => preset.id === "rapid_messages")?.description).toContain(
      "16 messages in 8 minutes",
    );
  });

  it("uses the triggered child's name in preset alert copy", () => {
    const preset = getDemoPreset("unknown_party_invite");
    expect(preset).toBeDefined();

    const alert = createDemoAlertFromPreset(
      preset!,
      "child_maya",
      1,
      new Date("2026-05-12T12:00:00Z"),
    );

    expect(alert.child).toBe("Maya");
    expect(alert.childId).toBe("child_maya");
    expect(alert.label).toMatch(/^Maya:/);
    expect(alert.event).toContain("Maya");
    expect(alert.event).not.toContain("Alex");
  });
});

describe("demo-store visibility policy", () => {
  beforeEach(() => {
    resetDemoAlerts(DEMO_CHILD_ID);
  });

  it("keeps the parent dashboard and feed empty until the worker triggers an alert", () => {
    const visibleAlerts = getDemoAlerts(DEMO_CHILD_ID);
    expect(visibleAlerts).toHaveLength(0);

    const allAlerts = getDemoAlerts(DEMO_CHILD_ID, { includeHidden: true });
    expect(allAlerts).toHaveLength(0);
  });

  it("generates default visible preset alerts", () => {
    const result = triggerDemoPreset(DEMO_CHILD_ID, "personal_info_request");
    expect(result).toBeDefined();
    expect(result?.alert.isParentVisible).toBe(true);
    expect(result?.alerts).toHaveLength(1);
    expect(result?.alert.childId).toBe(DEMO_CHILD_ID);
    expect(result?.alert.presetId).toBe("personal_info_request");
    expect(result?.alert.riskLevel).toBe("High");
  });

  it("allows hidden alert payloads from worker API contract", () => {
    triggerDemoPreset(DEMO_CHILD_ID, "rapid_messages", { isParentVisible: false });
    expect(getDemoAlerts(DEMO_CHILD_ID)).toHaveLength(0);
    expect(getDemoAlerts(DEMO_CHILD_ID, { includeHidden: true })).toHaveLength(1);
  });

  it("keeps summaries based on parent-visible alerts only", () => {
    triggerDemoPreset(DEMO_CHILD_ID, "rapid_messages");
    triggerDemoPreset(DEMO_CHILD_ID, "unknown_party_invite");
    triggerDemoPreset(DEMO_CHILD_ID, "gift_scam", { isParentVisible: false });

    const dashboard = getDemoDashboard(DEMO_CHILD_ID);
    expect(dashboard.riskLevel).toBe("High");
    expect(dashboard.counts.High).toBe(1);
    expect(dashboard.counts.Medium).toBe(1);
    expect(dashboard.recentAlerts).toHaveLength(2);
  });
});
