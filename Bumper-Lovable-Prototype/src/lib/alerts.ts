export type RiskLevel = "High" | "Medium" | "Low";

export type AlertSignal =
  | "new_contact"
  | "move_to_other_app"
  | "personal_info"
  | "late_night"
  | "high_frequency"
  | "private_call_invite"
  | "unknown_party_invite"
  | "gift_scam"
  | "link_shared";

export const ALERT_SIGNALS: readonly AlertSignal[] = [
  "new_contact",
  "move_to_other_app",
  "personal_info",
  "late_night",
  "high_frequency",
  "private_call_invite",
  "unknown_party_invite",
  "gift_scam",
  "link_shared",
];

export const DEMO_CHILD_ID = "child_alex";

export type AlertId = string | number;

export type Alert = {
  id: AlertId;
  publicId?: string;
  childId?: string;
  child: string;
  platform: string;
  event: string;
  eventType?: string;
  presetId?: string;
  label?: string;
  description?: string;
  riskScore?: number;
  riskLevel: RiskLevel;
  reason: string;
  parentAction: string;
  signals: AlertSignal[];
  date: string;
  createdAt: string;
  isHandled: boolean;
  isParentVisible?: boolean;
  contact?: string;
  contactHandleHash?: string;
  eventId?: string;
  messageCount?: number;
  windowMinutes?: number;
};

export const MOCK_ALERTS: Alert[] = [];

export const getAlertById = (id: AlertId) =>
  MOCK_ALERTS.find((alert) => String(alert.id) === String(id));
