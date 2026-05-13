import type { Alert, RiskLevel } from "@/lib/alerts";

export type DashboardAction =
  | { type: "section"; id: string; label: string }
  | { type: "metric"; id: string; label: string }
  | { type: "child"; id: string; label: string }
  | { type: "alert"; id: string; label: string };

export type DashboardFlowChild = {
  id: string;
  displayName: string;
  currentGameLabel: string;
  screenMinutes: number;
  alertCount: number;
  riskLevel: RiskLevel | null;
};

export type DashboardFlowContext = {
  children: readonly DashboardFlowChild[];
  alerts: readonly Alert[];
  lastUpdatedAt?: string | null;
};

export type DashboardActionState = {
  title: string;
  status: string;
  detail: string;
};

const visibleActiveAlerts = (alerts: readonly Alert[]): Alert[] =>
  alerts.filter((alert) => alert.isHandled !== true && alert.isParentVisible !== false);

const childAlerts = (alerts: readonly Alert[], childId: string): Alert[] =>
  visibleActiveAlerts(alerts).filter((alert) => alert.childId === childId);

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;

  return `${hours}h ${mins}m`;
};

export const dashboardActionSummary = (
  action: DashboardAction,
  context: DashboardFlowContext,
): string => {
  const alerts = visibleActiveAlerts(context.alerts);

  if (action.type === "metric" && action.id === "alerts") {
    return `${alerts.length} active ${alerts.length === 1 ? "alert" : "alerts"} across ${
      context.children.length
    } ${context.children.length === 1 ? "kid" : "kids"}`;
  }

  if (action.type === "section" && action.id === "conversation-starters") {
    return `${alerts.length} conversation ${alerts.length === 1 ? "starter" : "starters"} ready`;
  }

  return alerts.length > 0
    ? `${alerts.length} active ${alerts.length === 1 ? "alert" : "alerts"}`
    : "Dashboard synced";
};

export const buildDashboardActionState = (
  action: DashboardAction,
  context: DashboardFlowContext,
): DashboardActionState => {
  if (action.type === "child") {
    const child = context.children.find((entry) => entry.id === action.id);
    if (!child) {
      return {
        title: action.label,
        status: "Child summary unavailable",
        detail: "Refresh the dashboard to load the latest child state.",
      };
    }

    const alerts = childAlerts(context.alerts, child.id);
    return {
      title: child.displayName,
      status: `${child.currentGameLabel} now, ${child.alertCount} ${
        child.alertCount === 1 ? "alert" : "alerts"
      }`,
      detail: `${child.riskLevel ?? "Low"} risk, ${alerts.length} recent ${
        alerts.length === 1 ? "alert" : "alerts"
      }, ${minutesToTime(child.screenMinutes)} screen time today`,
    };
  }

  const summary = dashboardActionSummary(action, context);
  const firstChild = context.children[0];

  if (visibleActiveAlerts(context.alerts).length === 0 && firstChild) {
    return {
      title: action.label,
      status: "Dashboard synced",
      detail: `No active alerts. ${firstChild.displayName} is currently playing ${firstChild.currentGameLabel}.`,
    };
  }

  return {
    title: action.label,
    status: summary,
    detail: context.lastUpdatedAt
      ? `Last refreshed ${new Date(context.lastUpdatedAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}.`
      : "Review the latest dashboard state.",
  };
};
