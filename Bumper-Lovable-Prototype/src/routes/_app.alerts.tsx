import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertsPageLayout } from "@/components/guardian/alerts-page-layout";
import { useDemoAlerts } from "@/hooks/use-demo-alerts";
import { useReadAlerts } from "@/hooks/use-read-alerts";
import { childIds as fallbackChildIds } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/alerts")({
  head: () => ({
    meta: [
      { title: "New Alerts - Bumper" },
      { name: "description", content: "All unread safety alerts across your children." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const { alerts, loading } = useDemoAlerts(fallbackChildIds);
  const { isRead, markRead } = useReadAlerts();

  const unreadAlerts = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return alerts.filter(
      (alert) =>
        alert.isParentVisible !== false &&
        !isRead(alert) &&
        new Date(alert.createdAt).getTime() >= cutoff,
    );
  }, [alerts, isRead]);

  return (
    <AlertsPageLayout
      title="New Alerts"
      unitLabel="unread alert"
      unitLabelPlural="unread alerts"
      loading={loading}
      alerts={unreadAlerts}
      emptyTitle="There are no new alerts"
      emptyBody="Everything is calm right now. We'll let you know if something needs your attention."
      onMarkAllRead={() => markRead(unreadAlerts)}
      showReadButton
      showStartConversationButton
    />
  );
}
