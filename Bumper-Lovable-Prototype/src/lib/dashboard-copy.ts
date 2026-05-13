import type { Alert } from "@/lib/alerts";

export const highRiskAlertCount = (alerts: Alert[]): number =>
  alerts.filter((alert) => alert.riskLevel === "High" && !alert.isHandled).length;

export const formatDashboardTopMessage = (alerts: Alert[]): string => {
  const count = highRiskAlertCount(alerts);
  if (count === 0) return "Your kids are cruising safely.";
  if (count === 1) return "1 signal needs your attention.";
  return `${count} signals need your attention.`;
};
