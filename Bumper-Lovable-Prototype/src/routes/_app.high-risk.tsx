import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertsPageLayout } from "@/components/guardian/alerts-page-layout";
import { useDemoAlerts } from "@/hooks/use-demo-alerts";
import { useReadAlerts } from "@/hooks/use-read-alerts";
import { childIds as fallbackChildIds } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/high-risk")({
  head: () => ({
    meta: [
      { title: "High Risk Alerts - Bumper" },
      { name: "description", content: "Unread high-risk safety alerts across your children." },
    ],
  }),
  component: HighRiskPage,
});

function HighRiskPage() {
  const { alerts, loading } = useDemoAlerts(fallbackChildIds);
  const { isRead, markRead } = useReadAlerts();

  const unreadHighRisk = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return alerts.filter(
      (alert) =>
        alert.isParentVisible !== false &&
        alert.riskLevel === "High" &&
        !isRead(alert) &&
        new Date(alert.createdAt).getTime() >= cutoff,
    );
  }, [alerts, isRead]);

  return (
    <AlertsPageLayout
      title="High Risk Alerts"
      unitLabel="unread high-risk alert"
      unitLabelPlural="unread high-risk alerts"
      loading={loading}
      alerts={unreadHighRisk}
      emptyTitle="There are no new high-risk alerts"
      emptyBody="Nothing high-risk needs attention right now. We'll surface it here the moment it does."
      onMarkAllRead={() => markRead(unreadHighRisk)}
      showReadButton
      showStartConversationButton
    />
  );
}
