import type { Alert } from "@/lib/alerts";
import type { Signal } from "@/lib/mock-data";

const riskFromAlert = (alert: Alert): Signal["risk"] =>
  alert.riskLevel.toLowerCase() as Signal["risk"];

const typeFromAlert = (alert: Alert): Signal["type"] => {
  if (alert.signals.includes("move_to_other_app")) return "platform-hop";
  if (alert.signals.includes("personal_info")) return "personal-info";
  if (alert.signals.includes("high_frequency")) return "high-frequency";
  if (alert.signals.includes("late_night")) return "late-night";
  if (alert.signals.includes("new_contact")) return "new-contact";
  return "safe";
};

const signalScope = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const getAlertSignalId = (alert: Alert): string => `${signalScope(alert.child)}-${alert.id}`;
export const getAlertPublicSignalId = (alert: Alert): string =>
  alert.publicId ?? getAlertSignalId(alert);

export const mapAlertToSignal = (alert: Alert): Signal => ({
  id: getAlertPublicSignalId(alert),
  childName: alert.child,
  platform: alert.platform as Signal["platform"],
  risk: riskFromAlert(alert),
  pattern: alert.label ?? alert.event,
  description: alert.description ?? alert.reason,
  recommendation: alert.parentAction,
  contact: alert.contactHandleHash ?? alert.contact ?? alert.platform,
  timestamp: alert.date,
  type: typeFromAlert(alert),
});

export const toParentFeedSignals = (
  alerts: Alert[],
  options: { limit?: number } = {},
): Signal[] => {
  const signals = alerts
    .filter((alert) => !alert.isHandled && alert.isParentVisible !== false)
    .map(mapAlertToSignal);
  return typeof options.limit === "number" ? signals.slice(0, options.limit) : signals;
};
