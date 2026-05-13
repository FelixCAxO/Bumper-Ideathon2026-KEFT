import type { Alert } from "@/lib/alerts";

export type AccountConnectionChild = {
  id: string;
  currentGameLabel?: string;
};

export type AccountConnectionsSummary = {
  connectedCount: number;
  attentionCount: number;
  value: string;
  connectionPreview: string;
  alertBody: string;
};

const needsAccountAttention = (alert: Alert): boolean =>
  alert.isHandled !== true &&
  alert.isParentVisible !== false &&
  (alert.riskLevel === "High" ||
    alert.riskLevel === "Medium" ||
    alert.signals.some((signal) =>
      [
        "new_contact",
        "move_to_other_app",
        "private_call_invite",
        "unknown_party_invite",
        "link_shared",
      ].includes(signal),
    ));

export const buildAccountConnectionsSummary = (
  children: readonly AccountConnectionChild[],
  alerts: readonly Alert[],
): AccountConnectionsSummary => {
  const labels = children
    .map((child) => child.currentGameLabel?.trim())
    .filter((label): label is string => Boolean(label));
  const uniqueLabels = [...new Set(labels)];
  const attentionCount = alerts.filter(needsAccountAttention).length;

  return {
    connectedCount: uniqueLabels.length,
    attentionCount,
    value: `${uniqueLabels.length} connected`,
    connectionPreview: uniqueLabels.length > 0 ? uniqueLabels.join(", ") : "No connected apps",
    alertBody:
      attentionCount > 0
        ? `${attentionCount} account ${attentionCount === 1 ? "alert needs" : "alerts need"} attention`
        : "No account alerts need attention",
  };
};
