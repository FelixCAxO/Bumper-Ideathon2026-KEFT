import { describe, it, expect, beforeEach } from "vitest";
import { DEMO_CHILD_ID } from "../src/lib/alerts";
import {
  getDemoDashboard,
  getDemoAlerts,
  resetDemoAlerts,
  triggerDemoPreset,
} from "../src/lib/demo-store";

describe("demo-store", () => {
  beforeEach(() => {
    resetDemoAlerts(DEMO_CHILD_ID);
  });

  it("starts from a cleared alert log", () => {
    expect(getDemoAlerts(DEMO_CHILD_ID)).toHaveLength(0);
    expect(getDemoAlerts(DEMO_CHILD_ID, { includeHidden: true })).toHaveLength(0);
  });

  it("adds visible alerts with incrementing IDs", () => {
    const first = triggerDemoPreset(DEMO_CHILD_ID, "unknown_party_invite");
    const second = triggerDemoPreset(DEMO_CHILD_ID, "rapid_messages");
    expect(first?.alert.id).toBe(1);
    expect(second?.alert.id).toBe(2);
    expect(getDemoAlerts(DEMO_CHILD_ID)).toHaveLength(2);
  });

  it("builds dashboard summaries from visible alerts", () => {
    triggerDemoPreset(DEMO_CHILD_ID, "unknown_party_invite");
    triggerDemoPreset(DEMO_CHILD_ID, "rapid_messages");
    const dashboard = getDemoDashboard(DEMO_CHILD_ID);

    expect(dashboard.child.id).toBe(DEMO_CHILD_ID);
    expect(dashboard.gameStatus.currentGame.id).toBe("roblox");
    expect(dashboard.riskLevel).toBe("High");
    expect(dashboard.counts.High).toBe(1);
    expect(dashboard.counts.Medium).toBe(1);
    expect(dashboard.counts.Low).toBe(0);
    expect(dashboard.recentAlerts.map((alert) => alert.presetId)).toEqual([
      "rapid_messages",
      "unknown_party_invite",
    ]);
  });

  it("ignores hidden alerts for parent-facing summaries", () => {
    triggerDemoPreset(DEMO_CHILD_ID, "unknown_party_invite", { isParentVisible: false });
    const dashboard = getDemoDashboard(DEMO_CHILD_ID);
    expect(dashboard.riskLevel).toBe("Low");
    expect(dashboard.counts).toEqual({ Low: 0, Medium: 0, High: 0 });
    expect(dashboard.recentAlerts).toHaveLength(0);
  });

  it("clears triggered alerts when the worker log is reset", () => {
    triggerDemoPreset(DEMO_CHILD_ID, "unknown_party_invite");
    triggerDemoPreset(DEMO_CHILD_ID, "unknown_party_invite", { isParentVisible: false });

    resetDemoAlerts(DEMO_CHILD_ID);

    expect(getDemoAlerts(DEMO_CHILD_ID)).toHaveLength(0);
    expect(getDemoAlerts(DEMO_CHILD_ID, { includeHidden: true })).toHaveLength(0);
  });
});
