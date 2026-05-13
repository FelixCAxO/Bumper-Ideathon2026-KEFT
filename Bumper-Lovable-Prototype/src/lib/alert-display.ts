import type { Alert } from "@/lib/alerts";

const trimChildPrefix = (value: string, child: string): string => {
  const childPrefix = `${child.trim()}:`;
  return value.startsWith(childPrefix) ? value.slice(childPrefix.length).trim() : value;
};

export const parentFacingAlertTitle = (alert: Alert): string => {
  const primaryText = alert.description ?? alert.event ?? alert.label;
  if (primaryText) return trimChildPrefix(primaryText, alert.child);

  const eventType = alert.eventType?.toLowerCase() ?? "";
  if (eventType.includes("invite")) return "Unknown player invite";
  if (eventType.includes("personal")) return "Personal information request";
  if (eventType.includes("message")) return "Message pattern detected";
  if (alert.signals.includes("move_to_other_app")) return "Move to another app detected";
  if (alert.signals.includes("new_contact")) return "New contact detected";
  if (alert.signals.includes("personal_info")) return "Personal information request";
  if (alert.signals.includes("high_frequency")) return "High-frequency messages detected";
  if (alert.signals.includes("gift_scam")) return "Gift scam pattern detected";
  if (alert.signals.includes("private_call_invite")) return "Private call invite detected";
  if (alert.signals.includes("unknown_party_invite")) return "Unknown player invite";
  if (alert.signals.includes("link_shared")) return "Shared link detected";
  if (isConversationAlert(alert)) return "Stranger conversation detected";

  return "Safety alert detected";
};

export const parentFacingAlertDetail = (alert: Alert): string => {
  const detail = alert.reason || alert.parentAction || alert.label || alert.event;
  return trimChildPrefix(detail, alert.child);
};

export const isConversationAlert = (alert: Alert): boolean => {
  const eventType = alert.eventType?.toLowerCase() ?? "";
  const signals = alert.signals ?? [];

  return (
    eventType.includes("message") ||
    eventType.includes("contact") ||
    signals.includes("new_contact") ||
    signals.includes("high_frequency")
  );
};
