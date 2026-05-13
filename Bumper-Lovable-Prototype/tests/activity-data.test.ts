import { describe, expect, it } from "vitest";
import { buildActivityChartData, getLatestScreenTimeMinutes } from "../src/lib/activity-data";
import { getDemoDashboard, getDemoChildren } from "../src/lib/demo-store";
import { children } from "../src/lib/mock-data";

describe("screen-time activity data", () => {
  it("seeds real child profiles with May 13, 2026 and the previous 7 days", () => {
    for (const child of children) {
      expect(child.screenTimeHistory).toHaveLength(8);
      expect(child.screenTimeHistory.map((entry) => entry.date)).toEqual([
        "2026-05-06",
        "2026-05-07",
        "2026-05-08",
        "2026-05-09",
        "2026-05-10",
        "2026-05-11",
        "2026-05-12",
        "2026-05-13",
      ]);
      expect(child.screenTimeHistory.every((entry) => entry.minutes >= 0)).toBe(true);
    }
  });

  it("exposes screen-time history through the demo data contract", () => {
    const [alex] = getDemoChildren();
    const dashboard = getDemoDashboard("child_alex");

    expect(alex.screenTimeHistory).toEqual(children[0].screenTimeHistory);
    expect(dashboard.child.screenTimeHistory).toEqual(children[0].screenTimeHistory);
    expect(dashboard.activityWindow).toEqual({
      startDate: "2026-05-06",
      endDate: "2026-05-13",
      days: 8,
    });
  });

  it("builds chart rows from dated child screen-time history instead of generated waves", () => {
    const rows = buildActivityChartData(children.slice(0, 3), {
      endDate: "2026-05-13",
      daysBack: 7,
    });

    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row.day)).toEqual([
      "May 6",
      "May 7",
      "May 8",
      "May 9",
      "May 10",
      "May 11",
      "May 12",
      "May 13",
    ]);
    expect(rows[0]).toMatchObject({
      date: "2026-05-06",
      child_alex: 1.6,
      child_maya: 1.1,
      child_jordan: 1.4,
    });
    expect(rows[7]).toMatchObject({
      date: "2026-05-13",
      child_alex: 2.4,
      child_maya: 1.5,
      child_jordan: 1.3,
    });
  });

  it("uses today's screen-time entry for child summary totals", () => {
    expect(getLatestScreenTimeMinutes(children[0], "2026-05-13")).toBe(144);
    expect(getLatestScreenTimeMinutes(children[1], "2026-05-13")).toBe(90);
    expect(getLatestScreenTimeMinutes(children[2], "2026-05-13")).toBe(78);
  });
});
