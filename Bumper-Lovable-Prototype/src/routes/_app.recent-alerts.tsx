import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertsPageLayout } from "@/components/guardian/alerts-page-layout";
import { useDemoAlerts } from "@/hooks/use-demo-alerts";
import { childIds as fallbackChildIds } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/recent-alerts")({
  head: () => ({
    meta: [
      { title: "Recent Alerts - Bumper" },
      { name: "description", content: "Safety alerts from the last 7 days." },
    ],
  }),
  component: RecentAlertsPage,
});

function RecentAlertsPage() {
  const { alerts, loading } = useDemoAlerts(fallbackChildIds);

  const recentAlerts = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return alerts.filter(
      (alert) =>
        alert.isParentVisible !== false &&
        new Date(alert.createdAt).getTime() >= cutoff,
    );
  }, [alerts]);

  return (
    <AlertsPageLayout
      title="Recent Alerts"
      unitLabel="alert in the last 7 days"
      unitLabelPlural="alerts in the last 7 days"
      loading={loading}
      alerts={recentAlerts}
      emptyTitle="There are no recent alerts"
      emptyBody="No safety signals in the last 7 days. We'll surface them here as they come in."
      showCommentField
    />
  );
}
