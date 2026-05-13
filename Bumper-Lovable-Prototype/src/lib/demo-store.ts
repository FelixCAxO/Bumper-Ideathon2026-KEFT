import {
  ALERT_SIGNALS,
  DEMO_CHILD_ID,
  type Alert,
  type AlertId,
  type AlertSignal,
  type RiskLevel,
} from "@/lib/alerts";
import { buildAlertSummary, type AlertSummary } from "@/lib/alert-summary";
import { createDemoAlertFromPreset, getDemoPreset } from "@/lib/demo-presets";
import {
  availableGames,
  children,
  getChildById,
  getGameById,
  type Child,
  type GameOption,
  type ScreenTimeEntry,
} from "@/lib/mock-data";
import { buildActivityWindow, type ActivityWindow } from "@/lib/activity-data";

export type DashboardSummary = AlertSummary;

export type PublicChild = {
  id: string;
  displayName: string;
  ageBand: Child["ageBand"];
  gameStatus: PublicGameStatus;
  screenTimeHistory: ScreenTimeEntry[];
};

export type PublicGameStatus = {
  currentGame: GameOption;
  availableGames: GameOption[];
};

export type PublicAlertSummary = {
  id: AlertId;
  sequenceId?: number;
  presetId?: string;
  label: string;
  childId: string;
  description?: string;
  platform?: string;
  eventType?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
  parentAction: string;
  date: string;
  createdAt: string;
  isParentVisible: boolean;
  eventId?: string;
  signals: AlertSignal[];
};

export type PublicAlertDetail = PublicAlertSummary & {
  contactHandleHash: string;
  signals: AlertSignal[];
  messageCount?: number;
  windowMinutes?: number;
};

export type DashboardSnapshot = {
  child: {
    id: string;
    displayName: string;
    ageBand: Child["ageBand"];
    screenTimeHistory: ScreenTimeEntry[];
  };
  gameStatus: PublicGameStatus;
  activityWindow: ActivityWindow;
  riskLevel: RiskLevel;
  counts: Record<RiskLevel, number>;
  recentAlerts: PublicAlertSummary[];
  generatedAt: string;
  childId: string;
  alerts: Alert[];
  summary: DashboardSummary;
};

export type WorkerSignalPayload = {
  eventId?: unknown;
  idempotencyKey?: unknown;
  presetId?: unknown;
  label?: unknown;
  child?: unknown;
  childId?: unknown;
  platform?: unknown;
  event?: unknown;
  eventType?: unknown;
  description?: unknown;
  riskLevel?: unknown;
  riskScore?: unknown;
  reason?: unknown;
  parentAction?: unknown;
  signals?: unknown;
  date?: unknown;
  createdAt?: unknown;
  contact?: unknown;
  contactHandleHash?: unknown;
  messageCount?: unknown;
  windowMinutes?: unknown;
  isParentVisible?: unknown;
};

const alertStore = new Map<string, Alert[]>();
const gameStatusStore = new Map<string, GameOption["id"]>();

const signalScope = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const publicAlertId = (alert: Alert): string =>
  alert.publicId ?? `${alert.childId ?? signalScope(alert.child)}-${alert.id}`;

const cloneAlert = (alert: Alert): Alert => ({ ...alert, signals: [...alert.signals] });

const cloneAlertList = (alerts: Alert[]): Alert[] => alerts.map((alert) => cloneAlert(alert));

const getChildAlerts = (childId: string): Alert[] => {
  if (!alertStore.has(childId)) {
    alertStore.set(childId, []);
  }
  return alertStore.get(childId) ?? [];
};

const visibleAlerts = (alerts: Alert[]): Alert[] =>
  alerts.filter((alert) => !alert.isHandled && alert.isParentVisible !== false);

const activeAlerts = (alerts: Alert[]): Alert[] => alerts.filter((alert) => !alert.isHandled);

const numericAlertId = (id: AlertId): number => (typeof id === "number" ? id : 0);

const nextAlertId = (alerts: Alert[]): number =>
  alerts.reduce((maxId, alert) => Math.max(maxId, numericAlertId(alert.id)), 0) + 1;

const compareAlertIdsDescending = (a: Alert, b: Alert): number => {
  const numericDiff = numericAlertId(b.id) - numericAlertId(a.id);
  if (numericDiff !== 0) return numericDiff;
  return String(b.id).localeCompare(String(a.id));
};

const asNonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const isRiskLevel = (value: unknown): value is RiskLevel =>
  value === "High" || value === "Medium" || value === "Low";

const isAlertSignal = (value: unknown): value is AlertSignal =>
  typeof value === "string" && ALERT_SIGNALS.includes(value as AlertSignal);

const parseAlertSignals = (value: unknown): AlertSignal[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const parsed = value.filter(isAlertSignal);
  return parsed.length === value.length ? parsed : undefined;
};

export const normalizeDemoChildId = (childId: string | null | undefined): string => {
  const trimmed = childId?.trim();
  if (trimmed && getChildById(trimmed)) return trimmed;
  return DEMO_CHILD_ID;
};

const childDisplayName = (childId: string): string =>
  getChildById(childId)?.displayName ?? childId.replace(/^child_/, "");

export const getDemoGameStatus = (childId = DEMO_CHILD_ID): PublicGameStatus => {
  const normalizedChildId = normalizeDemoChildId(childId);
  const child = getChildById(normalizedChildId) ?? children[0];
  const storedGameId = gameStatusStore.get(normalizedChildId);
  const currentGame = (storedGameId && getGameById(storedGameId)) ?? child.gameStatus.currentGame;

  return {
    currentGame,
    availableGames,
  };
};

export const setDemoGameStatus = (
  childId: string,
  gameId: string,
): PublicGameStatus | undefined => {
  const normalizedChildId = normalizeDemoChildId(childId);
  const game = getGameById(gameId);
  if (!game) return undefined;

  gameStatusStore.set(normalizedChildId, game.id);
  return getDemoGameStatus(normalizedChildId);
};

export const resetDemoGameStatus = (childId = DEMO_CHILD_ID): void => {
  gameStatusStore.delete(normalizeDemoChildId(childId));
};

export const getDemoChildren = (): PublicChild[] =>
  children.map((child) => ({
    id: child.id,
    displayName: child.displayName,
    ageBand: child.ageBand,
    gameStatus: getDemoGameStatus(child.id),
    screenTimeHistory: [...child.screenTimeHistory],
  }));

const addPublicFields = (alert: Alert): Alert => {
  const cloned = cloneAlert(alert);
  return {
    ...cloned,
    publicId: publicAlertId(cloned),
  };
};

export const getDemoAlerts = (
  childId = DEMO_CHILD_ID,
  options: { includeHidden?: boolean } = {},
): Alert[] => {
  const normalizedChildId = normalizeDemoChildId(childId);
  const alerts = getChildAlerts(normalizedChildId);
  const source = options.includeHidden ? activeAlerts(alerts) : visibleAlerts(alerts);
  return cloneAlertList(source)
    .sort(compareAlertIdsDescending)
    .map(addPublicFields);
};

export const toPublicAlertSummary = (alert: Alert): PublicAlertSummary => {
  const childId = alert.childId ?? normalizeDemoChildId(undefined);
  const description = alert.description ?? alert.event;

  return {
    id: publicAlertId(alert),
    ...(typeof alert.id === "number" ? { sequenceId: alert.id } : {}),
    presetId: alert.presetId,
    label: alert.label ?? description,
    childId,
    description,
    platform: alert.platform,
    eventType: alert.eventType ?? alert.presetId ?? "worker_signal",
    riskScore:
      alert.riskScore ?? (alert.riskLevel === "High" ? 90 : alert.riskLevel === "Medium" ? 60 : 20),
    riskLevel: alert.riskLevel,
    reason: alert.reason,
    parentAction: alert.parentAction,
    date: alert.date,
    createdAt: alert.createdAt,
    isParentVisible: alert.isParentVisible !== false,
    eventId: alert.eventId,
    signals: [...alert.signals],
  };
};

export const toPublicAlertDetail = (alert: Alert): PublicAlertDetail => ({
  ...toPublicAlertSummary(alert),
  contactHandleHash:
    alert.contactHandleHash ?? `contact_${(alert.childId ?? alert.child).replace(/^child_/, "")}`,
  signals: [...alert.signals],
  messageCount: alert.messageCount,
  windowMinutes: alert.windowMinutes,
});

export const getPublicAlerts = (childId = DEMO_CHILD_ID, limit = 50): PublicAlertSummary[] =>
  getDemoAlerts(childId).slice(0, limit).map(toPublicAlertSummary);

export const findDemoAlertByPublicId = (alertId: string): PublicAlertDetail | undefined => {
  for (const alerts of alertStore.values()) {
    const alert = visibleAlerts(alerts).find((entry) => publicAlertId(entry) === alertId);
    if (alert) return toPublicAlertDetail(addPublicFields(alert));
  }
  return undefined;
};

export const triggerDemoPreset = (
  childId: string,
  presetId: string,
  options: { isParentVisible?: boolean } = {},
): { alert: Alert; alerts: Alert[] } | undefined => {
  const preset = getDemoPreset(presetId);
  if (!preset) return undefined;

  const normalizedChildId = normalizeDemoChildId(childId);
  const alerts = getChildAlerts(normalizedChildId);
  const alert = createDemoAlertFromPreset(
    preset,
    normalizedChildId,
    nextAlertId(alerts),
    new Date(),
    options.isParentVisible ?? true,
  );
  alerts.push(alert);

  return { alert: addPublicFields(alert), alerts: getDemoAlerts(normalizedChildId) };
};

export const ingestWorkerSignal = (
  childId: string,
  payload: WorkerSignalPayload,
  receivedAt = new Date(),
): { alert: Alert; alerts: Alert[]; created: boolean } | undefined => {
  const eventId = asNonEmptyString(payload.eventId) ?? asNonEmptyString(payload.idempotencyKey);
  if (!eventId) return undefined;

  const normalizedChildId = normalizeDemoChildId(childId);
  const alerts = getChildAlerts(normalizedChildId);
  const existingAlert = alerts.find((alert) => alert.eventId === eventId);
  if (existingAlert) {
    return {
      alert: addPublicFields(existingAlert),
      alerts: getDemoAlerts(normalizedChildId),
      created: false,
    };
  }

  const platform = asNonEmptyString(payload.platform);
  const event =
    asNonEmptyString(payload.description) ??
    asNonEmptyString(payload.event) ??
    asNonEmptyString(payload.label);
  const reason = asNonEmptyString(payload.reason);
  const parentAction = asNonEmptyString(payload.parentAction);
  const signals = parseAlertSignals(payload.signals);

  if (
    !platform ||
    !event ||
    !reason ||
    !parentAction ||
    !isRiskLevel(payload.riskLevel) ||
    !signals
  ) {
    return undefined;
  }

  const createdAt = asNonEmptyString(payload.createdAt) ?? receivedAt.toISOString();
  const alert: Alert = {
    id: nextAlertId(alerts),
    childId: normalizedChildId,
    child: asNonEmptyString(payload.child) ?? childDisplayName(normalizedChildId),
    platform,
    event,
    eventType: asNonEmptyString(payload.eventType) ?? asNonEmptyString(payload.presetId),
    presetId: asNonEmptyString(payload.presetId),
    label: asNonEmptyString(payload.label) ?? event,
    description: event,
    riskScore: asNumber(payload.riskScore),
    riskLevel: payload.riskLevel,
    reason,
    parentAction,
    signals,
    date: asNonEmptyString(payload.date) ?? createdAt,
    createdAt,
    isHandled: false,
    isParentVisible: typeof payload.isParentVisible === "boolean" ? payload.isParentVisible : true,
    contact: asNonEmptyString(payload.contact),
    contactHandleHash: asNonEmptyString(payload.contactHandleHash),
    eventId,
    messageCount: asNumber(payload.messageCount),
    windowMinutes: asNumber(payload.windowMinutes),
  };

  alerts.push(alert);
  return { alert: addPublicFields(alert), alerts: getDemoAlerts(normalizedChildId), created: true };
};

const countByRisk = (alerts: Alert[]): Record<RiskLevel, number> => ({
  Low: alerts.filter((alert) => alert.riskLevel === "Low").length,
  Medium: alerts.filter((alert) => alert.riskLevel === "Medium").length,
  High: alerts.filter((alert) => alert.riskLevel === "High").length,
});

export const getDemoDashboard = (childId = DEMO_CHILD_ID): DashboardSnapshot => {
  const normalizedChildId = normalizeDemoChildId(childId);
  const child = getChildById(normalizedChildId) ?? children[0];
  const alerts = getDemoAlerts(normalizedChildId);
  const summary = buildAlertSummary(alerts);

  return {
    child: {
      id: child.id,
      displayName: child.displayName,
      ageBand: child.ageBand,
      screenTimeHistory: [...child.screenTimeHistory],
    },
    gameStatus: getDemoGameStatus(normalizedChildId),
    activityWindow: buildActivityWindow({ endDate: "2026-05-13", daysBack: 7 }),
    riskLevel: summary.overallRisk,
    counts: countByRisk(alerts),
    recentAlerts: alerts.slice(0, 5).map(toPublicAlertSummary),
    generatedAt: new Date().toISOString(),
    childId: normalizedChildId,
    alerts,
    summary,
  };
};

export const resetDemoAlerts = (childId = DEMO_CHILD_ID): number => {
  const normalizedChildId = normalizeDemoChildId(childId);
  const deletedCount = getChildAlerts(normalizedChildId).length;
  alertStore.delete(normalizedChildId);
  return deletedCount;
};
