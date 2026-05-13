import {
  DEMO_CHILD_ID,
  type Alert,
  type AlertId,
  type AlertSignal,
  type RiskLevel,
} from "@/lib/alerts";
import type { AlertSummary } from "@/lib/alert-summary";
import {
  findDemoAlertByPublicId,
  getDemoAlerts as getLocalDemoAlerts,
  getDemoChildren as getLocalDemoChildren,
  getDemoDashboard as getLocalDemoDashboard,
  setDemoGameStatus as setLocalDemoGameStatus,
  toPublicAlertSummary,
  triggerDemoPreset as triggerLocalDemoPreset,
  type DashboardSnapshot,
  type PublicAlertDetail,
  type PublicAlertSummary,
  type PublicChild,
  type PublicGameStatus,
} from "@/lib/demo-store";
import { DEMO_PRESETS } from "@/lib/demo-presets";

export type DemoSummary = AlertSummary;

export type DemoDashboardResponse = Omit<DashboardSnapshot, "alerts" | "summary"> &
  Partial<Pick<DashboardSnapshot, "alerts" | "summary">>;

export type DemoChildrenResponse = {
  children: PublicChild[];
};

export type DemoPresetsResponse = {
  childId: string;
  presets: Array<{
    id: string;
    label: string;
    description: string;
    gameId: string;
    platform: string;
    eventType: string;
    expectedRiskLevel: RiskLevel;
    setting: string;
  }>;
};

export type DemoAlertsResponse = {
  childId: string;
  alerts: PublicAlertSummary[];
  generatedAt: string;
};

const DEFAULT_API_BASE = "";
const VITE_API_BASE = import.meta.env.VITE_API_BASE_URL?.toString().trim() ?? "";
const VITE_DEMO_CONTROL_PANEL_URL =
  import.meta.env.VITE_DEMO_CONTROL_PANEL_URL?.toString().trim() ?? "";

const demoApiBaseUrl = (): string => {
  const base = VITE_API_BASE || DEFAULT_API_BASE;
  return base.replace(/\/$/, "");
};

export const DEMO_CONTROL_PANEL_URL = VITE_DEMO_CONTROL_PANEL_URL || "http://127.0.0.1:8787/demo";

const buildUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = demoApiBaseUrl();
  if (!base) return normalizedPath;
  return `${base}${normalizedPath}`;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body || response.statusText}`);
  }

  return (await response.json()) as T;
};

export const isDemoMode = (): boolean => true;

export const getDemoPollIntervalMs = (): number => (isDemoMode() ? 60_000 : 120_000);

const childNameFromId = (childId: string): string => {
  const name = childId.replace(/^child_/, "").trim();
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : "Child";
};

export const alertSummaryToAlert = (summary: PublicAlertSummary): Alert => ({
  id: summary.id,
  publicId: String(summary.id),
  childId: summary.childId,
  child: childNameFromId(summary.childId),
  platform: summary.platform ?? "Bumper",
  event: summary.description ?? summary.label,
  eventType: summary.eventType ?? summary.presetId ?? "backend_signal",
  presetId: summary.presetId,
  label: summary.label,
  description: summary.description ?? summary.label,
  riskScore: summary.riskScore,
  riskLevel: summary.riskLevel,
  reason: summary.reason,
  parentAction: summary.parentAction,
  signals: ((summary as { signals?: AlertSignal[] }).signals ?? []) as AlertSignal[],
  date: summary.date,
  createdAt: summary.createdAt,
  isHandled: false,
  isParentVisible: summary.isParentVisible,
  eventId: summary.eventId,
});

export const alertDetailToAlert = (detail: PublicAlertDetail): Alert => ({
  ...alertSummaryToAlert(detail),
  contactHandleHash: detail.contactHandleHash,
  signals: detail.signals,
  messageCount: detail.messageCount,
  windowMinutes: detail.windowMinutes,
});

let simulatedSeeded = false;
const seedSimulatedAlerts = () => {
  if (simulatedSeeded) return;
  simulatedSeeded = true;
  const seedPlan: Array<{ childId: string; presetId: string }> = [
    { childId: "child_alex", presetId: "unknown_party_invite" },
    { childId: "child_alex", presetId: "rapid_messages" },
    { childId: "child_maya", presetId: "personal_info_request" },
    { childId: "child_maya", presetId: "gift_scam" },
    { childId: "child_jordan", presetId: "roblox_discord_move" },
  ];
  for (const { childId, presetId } of seedPlan) {
    if (DEMO_PRESETS.some((p) => p.id === presetId)) {
      triggerLocalDemoPreset(childId, presetId);
    }
  }
};

const localDashboard = (childId: string): DemoDashboardResponse => {
  seedSimulatedAlerts();
  return getLocalDemoDashboard(childId);
};

const localAlerts = (childId: string): DemoAlertsResponse => {
  seedSimulatedAlerts();
  return {
    childId,
    alerts: getLocalDemoAlerts(childId).map(toPublicAlertSummary),
    generatedAt: new Date().toISOString(),
  };
};

const withFallback = async <T>(attempt: () => Promise<T>, fallback: () => T): Promise<T> => {
  try {
    return await attempt();
  } catch (error) {
    if (typeof console !== "undefined") {
      console.warn("[demo-client] backend unreachable, using simulated alerts:", error);
    }
    return fallback();
  }
};

export const getDemoChildren = async (): Promise<DemoChildrenResponse> => {
  return withFallback(
    async () => parseJson<DemoChildrenResponse>(await fetch(buildUrl("/api/demo/children"))),
    () => {
      seedSimulatedAlerts();
      return { children: getLocalDemoChildren() };
    },
  );
};

export const getDemoPresets = async (childId = DEMO_CHILD_ID): Promise<DemoPresetsResponse> => {
  return withFallback(
    async () =>
      parseJson<DemoPresetsResponse>(
        await fetch(buildUrl(`/api/demo/presets?childId=${encodeURIComponent(childId)}`)),
      ),
    () => ({
      childId,
      presets: DEMO_PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.id,
        description: preset.eventType,
        gameId: preset.gameId,
        platform: preset.platform,
        eventType: preset.eventType,
        expectedRiskLevel: preset.riskLevel,
        setting: "simulated",
      })),
    }),
  );
};

export const getDashboard = async (childId = DEMO_CHILD_ID): Promise<DemoDashboardResponse> => {
  return withFallback(
    async () =>
      parseJson<DemoDashboardResponse>(
        await fetch(buildUrl(`/api/dashboard/${encodeURIComponent(childId)}`)),
      ),
    () => localDashboard(childId),
  );
};

export const getAlerts = async (childId = DEMO_CHILD_ID): Promise<DemoAlertsResponse> => {
  return withFallback(
    async () =>
      parseJson<DemoAlertsResponse>(
        await fetch(buildUrl(`/api/alerts/${encodeURIComponent(childId)}`)),
      ),
    () => localAlerts(childId),
  );
};

export const getAlertDetail = async (alertId: AlertId): Promise<PublicAlertDetail> => {
  return withFallback(
    async () =>
      parseJson<PublicAlertDetail>(
        await fetch(buildUrl(`/api/alert/${encodeURIComponent(alertId)}`)),
      ),
    () => {
      const local = findDemoAlertByPublicId(String(alertId));
      if (!local) throw new Error(`Alert ${alertId} not found in simulated data`);
      return local;
    },
  );
};

export const updateDemoGameStatus = async (
  childId: string,
  gameId: string,
): Promise<{ childId: string; gameStatus: PublicGameStatus }> => {
  return withFallback(
    async () =>
      parseJson<{ childId: string; gameStatus: PublicGameStatus }>(
        await fetch(buildUrl(`/api/game-status/${encodeURIComponent(childId)}`), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ gameId }),
        }),
      ),
    () => {
      const gameStatus = setLocalDemoGameStatus(childId, gameId);
      if (!gameStatus) throw new Error(`Unknown game ${gameId}`);
      return { childId, gameStatus };
    },
  );
};

export const triggerDemoPreset = async (
  presetId: string,
  childId = DEMO_CHILD_ID,
  options?: { isParentVisible?: boolean },
): Promise<PublicAlertSummary> => {
  const payload = options ? { childId, ...options } : { childId };

  return withFallback(
    async () =>
      parseJson<PublicAlertSummary>(
        await fetch(buildUrl(`/api/demo/events/${encodeURIComponent(presetId)}`), {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }),
      ),
    () => {
      seedSimulatedAlerts();
      const result = triggerLocalDemoPreset(childId, presetId, options);
      if (!result) throw new Error(`Unknown preset ${presetId}`);
      return toPublicAlertSummary(result.alert);
    },
  );
};
