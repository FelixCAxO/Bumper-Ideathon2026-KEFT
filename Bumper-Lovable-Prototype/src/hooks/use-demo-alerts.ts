import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_CHILD_ID, type Alert } from "@/lib/alerts";
import { buildAlertSummary } from "@/lib/alert-summary";
import {
  alertSummaryToAlert,
  getAlerts,
  getDashboard,
  getDemoPollIntervalMs,
  isDemoMode,
  triggerDemoPreset,
} from "@/lib/demo-client";
import {
  type DemoAlertsResponse,
  type DemoDashboardResponse,
  type DemoSummary,
} from "@/lib/demo-client";
import type { PublicAlertSummary } from "@/lib/demo-store";

type DemoAlertState = {
  alerts: Alert[];
  summary: DemoSummary;
  dashboard: DemoDashboardResponse | null;
  dashboardsByChildId: Record<string, DemoDashboardResponse>;
  loading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  isDemoMode: boolean;
  pollIntervalMs: number;
  refresh: () => Promise<void>;
  triggerPreset: (presetId: string) => Promise<void>;
};

type ChildIdInput = string | readonly string[];
type AlertSnapshot = { alerts?: Alert[]; recentAlerts?: PublicAlertSummary[] };
type DemoAlertSnapshotState = {
  alerts: Alert[];
  summary: DemoSummary;
  lastUpdatedAt: string;
};
type DemoAlertSnapshotClient = {
  getDashboard: (childId: string) => Promise<DemoDashboardResponse>;
  getAlerts: (childId: string) => Promise<DemoAlertsResponse>;
};
type DemoAlertSnapshotOptions = {
  includeFullAlertFeed?: boolean;
};

const normalizeChildIds = (childId: ChildIdInput): string[] => {
  const source = Array.isArray(childId) ? childId : [childId];
  const normalized = source
    .map((value) => value.trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  return normalized.length > 0 ? normalized : [DEMO_CHILD_ID];
};

const alertKey = (alert: Alert) => alert.publicId ?? `${alert.child}:${String(alert.id)}`;

const compareAlertIdsDescending = (a: Alert, b: Alert): number => {
  if (typeof a.id === "number" && typeof b.id === "number") {
    return b.id - a.id;
  }
  return String(b.id).localeCompare(String(a.id));
};

const dedupeByAlertKey = (alerts: Alert[], incoming: Alert[]) => {
  const seen = new Map<string, Alert>();
  for (const alert of alerts) {
    seen.set(alertKey(alert), alert);
  }
  for (const alert of incoming) {
    seen.set(alertKey(alert), alert);
  }
  return [...seen.values()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      compareAlertIdsDescending(a, b),
  );
};

const buildSummaryFromAlerts = (alerts: Alert[], options: { now?: Date } = {}): DemoSummary => ({
  ...buildAlertSummary(alerts, options),
});

export const buildDemoAlertStateFromSnapshots = (
  previousAlerts: Alert[],
  snapshots: AlertSnapshot[],
  options: { now?: Date } = {},
): DemoAlertSnapshotState => {
  void previousAlerts;
  const alerts = dedupeByAlertKey(
    [],
    snapshots.flatMap(
      (snapshot) => snapshot.alerts ?? snapshot.recentAlerts?.map(alertSummaryToAlert) ?? [],
    ),
  );
  return {
    alerts,
    summary: buildSummaryFromAlerts(alerts, options),
    lastUpdatedAt: (options.now ?? new Date()).toISOString(),
  };
};

export const loadDemoAlertSnapshots = async (
  childIds: readonly string[],
  client: DemoAlertSnapshotClient = { getDashboard, getAlerts },
  options: DemoAlertSnapshotOptions = {},
): Promise<DemoDashboardResponse[]> =>
  Promise.all(
    childIds.map(async (id) => {
      const dashboardSnapshot = await client.getDashboard(id);

      if (!options.includeFullAlertFeed) {
        return {
          ...dashboardSnapshot,
          alerts: dashboardSnapshot.recentAlerts
            ? dashboardSnapshot.recentAlerts.map(alertSummaryToAlert)
            : (dashboardSnapshot.alerts ?? []),
        };
      }

      const alertFeed = await client.getAlerts(id);

      return {
        ...dashboardSnapshot,
        alerts: alertFeed.alerts.map(alertSummaryToAlert),
      };
    }),
  );

export const buildDashboardsByChildId = (
  snapshots: readonly DemoDashboardResponse[],
): Record<string, DemoDashboardResponse> =>
  Object.fromEntries(
    snapshots
      .filter((snapshot) => Boolean(snapshot.childId))
      .map((snapshot) => [snapshot.childId, snapshot]),
  );

export const useDemoAlerts = (childId: ChildIdInput = DEMO_CHILD_ID): DemoAlertState => {
  const childIds = useMemo(() => normalizeChildIds(childId), [childId]);
  const primaryChildId = childIds[0] ?? DEMO_CHILD_ID;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<DemoSummary>(() => buildSummaryFromAlerts([]));
  const [dashboard, setDashboard] = useState<DemoDashboardResponse | null>(null);
  const [dashboardsByChildId, setDashboardsByChildId] = useState<
    Record<string, DemoDashboardResponse>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const activeLoadRef = useRef<Promise<void> | null>(null);

  const pollIntervalMs = useMemo(() => getDemoPollIntervalMs(), []);
  const demoMode = isDemoMode();
  const isReady = demoMode;

  const load = useCallback(async () => {
    if (activeLoadRef.current) return activeLoadRef.current;

    const requestId = ++requestSeq.current;
    let loadPromise!: Promise<void>;
    loadPromise = (async () => {
      try {
        setLoading(true);
        setError(null);
        const snapshots = await loadDemoAlertSnapshots(childIds);
        if (requestId !== requestSeq.current) return;
        const nextState = buildDemoAlertStateFromSnapshots([], snapshots);
        setAlerts(nextState.alerts);
        setSummary(nextState.summary);
        setDashboard(
          snapshots.find((snapshot) => snapshot.childId === primaryChildId) ?? snapshots[0] ?? null,
        );
        setDashboardsByChildId(buildDashboardsByChildId(snapshots));
        setLastUpdatedAt(nextState.lastUpdatedAt);
      } catch (_error) {
        if (requestId !== requestSeq.current) return;
        const message = _error instanceof Error ? _error.message : "Unable to load demo data.";
        setError(message);
      } finally {
        if (requestId === requestSeq.current) {
          setLoading(false);
        }
        if (activeLoadRef.current === loadPromise) {
          activeLoadRef.current = null;
        }
      }
    })();

    activeLoadRef.current = loadPromise;
    return loadPromise;
  }, [childIds, primaryChildId]);

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [load, pollIntervalMs]);

  const triggerPreset = useCallback(
    async (presetId: string) => {
      if (!isReady) return;
      try {
        setError(null);
        await triggerDemoPreset(presetId, primaryChildId);
        await load();
      } catch (presetError) {
        const message =
          presetError instanceof Error ? presetError.message : "Failed to trigger demo preset.";
        setError(message);
      }
    },
    [isReady, load, primaryChildId],
  );

  return {
    alerts,
    summary,
    dashboard,
    dashboardsByChildId,
    loading,
    error,
    lastUpdatedAt,
    isDemoMode: demoMode,
    pollIntervalMs,
    refresh: load,
    triggerPreset,
  };
};
