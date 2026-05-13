import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("dashboard redesign route shell", () => {
  it("keeps /dashboard as the dashboard-owned app shell", () => {
    const appRoute = read("src/routes/_app.tsx");

    expect(appRoute).toContain("return <Outlet />");
    expect(appRoute).not.toContain("@/components/Layout");
    expect(appRoute).not.toContain("useRouterState");
  });

  it("renders the full-width Bumper dashboard from all tracked children", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");

    expect(dashboard).toContain("trackedChildIds");
    expect(dashboard).toContain("useDemoAlerts(trackedChildIds)");
    expect(dashboard).toContain("Good morning");
    expect(dashboard).toContain("Your Children");
    expect(dashboard).toContain("Activity Overview");
    expect(dashboard).toContain("Recent Alerts");
    expect(dashboard).toContain("Conversation Starters");
    expect(dashboard).toContain("BumperDashboardBanner");
    expect(dashboard).toContain("buildAccountConnectionsSummary");
    expect(dashboard).toContain("Account Connections");
    expect(dashboard).toContain("accountConnections.connectionPreview");
    expect(dashboard).toContain("accountConnections.alertBody");
    expect(dashboard).toContain("sm:grid-cols-2 2xl:grid-cols-4");
    expect(dashboard).toContain("2xl:grid-cols-[minmax(0,1.07fr)_minmax(360px,0.93fr)]");
    expect(dashboard).toContain("ResponsiveContainer");
    expect(dashboard).toContain("LineChart");
    expect(dashboard).toContain("buildActivityChartData");
    expect(dashboard).toContain("getLatestScreenTimeMinutes");
    expect(dashboard).not.toContain('title="Avg. screen time"');
    expect(dashboard).not.toContain("function buildActivityData");
    expect(dashboard).not.toContain("Math.sin");
  });

  it("uses the brand logo component in the dashboard chrome", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");

    expect(dashboard).toContain('from "@/components/guardian/brand-assets"');
    expect(dashboard).toContain("<BumperLogo");
    expect(dashboard).toContain('aria-label="Bumper dashboard home"');
    expect(dashboard).not.toContain("function BumperMark");
  });

  it("keeps the dashboard free of old selected-child demo control UI", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");

    expect(dashboard).not.toContain("selectedChildId");
    expect(dashboard).not.toContain("Open demo controls");
    expect(dashboard).not.toContain("DEMO_CONTROL_PANEL_URL");
    expect(dashboard).not.toContain("formatDashboardTopMessage");
  });

  it("renders Recent Alerts from parent-facing alert copy, not child-prefixed labels", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");

    expect(dashboard).toContain("parentFacingAlertTitle(alert)");
    expect(dashboard).toContain("parentFacingAlertDetail(alert)");
    expect(dashboard).not.toContain("alertTitle(alert)");
  });

  it("shows each child's API current game between their name and alert count", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");

    expect(dashboard).toContain("currentGameLabel");
    expect(dashboard).toContain("child.gameStatus?.currentGame?.label");
    expect(dashboard).toContain("{child.currentGameLabel}");

    const namePosition = dashboard.indexOf("{child.displayName}");
    const gamePosition = dashboard.indexOf("{child.currentGameLabel}");
    const alertsPosition = dashboard.indexOf("{child.alertCount}");

    expect(namePosition).toBeGreaterThan(-1);
    expect(gamePosition).toBeGreaterThan(namePosition);
    expect(alertsPosition).toBeGreaterThan(gamePosition);
  });

  it("wires every dashboard button through clickable flow actions", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");

    expect(dashboard).toContain("buildDashboardActionState");
    expect(dashboard).toContain("const [activeAction, setActiveAction]");
    expect(dashboard).toContain("handleAction");
    expect(dashboard).toContain("action={");
    expect(dashboard).toContain("onAction={handleAction}");
    expect(dashboard).toContain("DashboardFlowStatus");
    expect(dashboard).toContain('aria-live="polite"');
    expect(dashboard).not.toContain(
      '<button\n            key={label}\n            type="button"\n            className=',
    );
  });
});
