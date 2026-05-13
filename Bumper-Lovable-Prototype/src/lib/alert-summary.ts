import type { Alert, RiskLevel } from "@/lib/alerts";

export type AlertSummary = {
  overallRisk: RiskLevel;
  weeklySummary: {
    newContacts: number;
    highRiskPatterns: number;
    moveToOtherAppRequests: number;
    personalInfoLeaks: number;
  };
};

const hasSignal = (alert: Alert, signal: Alert["signals"][number]) =>
  alert.signals.includes(signal);

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const isWithinTrailingWeek = (alert: Alert, now: Date): boolean => {
  const createdAt = new Date(alert.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return createdAt.getTime() >= now.getTime() - ONE_WEEK_MS && createdAt.getTime() <= now.getTime();
};

export const buildAlertSummary = (alerts: Alert[], options: { now?: Date } = {}): AlertSummary => {
  const activeAlerts = alerts.filter(
    (alert) => !alert.isHandled && alert.isParentVisible !== false,
  );
  const weeklyAlerts = activeAlerts.filter((alert) =>
    isWithinTrailingWeek(alert, options.now ?? new Date()),
  );
  const hasHigh = activeAlerts.some((alert) => alert.riskLevel === "High");
  const hasMedium = activeAlerts.some((alert) => alert.riskLevel === "Medium");

  return {
    overallRisk: hasHigh ? "High" : hasMedium ? "Medium" : "Low",
    weeklySummary: {
      newContacts: weeklyAlerts.filter((alert) => hasSignal(alert, "new_contact")).length,
      highRiskPatterns: weeklyAlerts.filter((alert) => alert.riskLevel === "High").length,
      moveToOtherAppRequests: weeklyAlerts.filter((alert) => hasSignal(alert, "move_to_other_app"))
        .length,
      personalInfoLeaks: weeklyAlerts.filter((alert) => hasSignal(alert, "personal_info")).length,
    },
  };
};
