import type { Alert, RiskLevel } from "@/lib/alerts";
import type { Child, Platform, Risk } from "@/lib/mock-data";

const riskRank: Record<RiskLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

const riskScore: Record<RiskLevel, number> = {
  Low: 15,
  Medium: 55,
  High: 90,
};

const riskLabel: Record<RiskLevel, Risk> = {
  Low: "low",
  Medium: "medium",
  High: "high",
};

const knownPlatforms = new Set<Platform>([
  "Discord",
  "Roblox",
  "Steam",
  "Fortnite",
  "Apex Legends",
  "Valorant",
  "Overwatch 2",
]);

const childMatchesAlert = (child: Child, alert: Alert): boolean => {
  const alertChild = alert.child.trim().toLowerCase();
  return (
    alert.childId === child.id ||
    alertChild === child.id.toLowerCase() ||
    alertChild === child.name.toLowerCase() ||
    alertChild === child.displayName.toLowerCase()
  );
};

const platformForCard = (platform: string, fallback: Platform): Platform =>
  knownPlatforms.has(platform as Platform) ? (platform as Platform) : fallback;

const mostSevereAlert = (alerts: Alert[]): Alert | undefined =>
  alerts.reduce<Alert | undefined>((current, alert) => {
    if (!current) return alert;
    return riskRank[alert.riskLevel] > riskRank[current.riskLevel] ? alert : current;
  }, undefined);

export const buildChildCardsFromAlerts = (baseChildren: Child[], alerts: Alert[]): Child[] =>
  baseChildren.map((child) => {
    const activeAlerts = alerts.filter(
      (alert) =>
        !alert.isHandled && alert.isParentVisible !== false && childMatchesAlert(child, alert),
    );
    const alert = mostSevereAlert(activeAlerts);
    if (!alert) return child;

    return {
      ...child,
      risk: riskLabel[alert.riskLevel],
      riskScore: riskScore[alert.riskLevel],
      lastActive: alert.date,
      platform: platformForCard(alert.platform, child.platform),
    };
  });
