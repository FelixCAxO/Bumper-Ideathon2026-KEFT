import { HttpError } from "./errors";
import {
  getDemoPage,
  hasValidDemoSession,
  loginDemo,
  logoutDemo,
  redirect
} from "./demoPage";
import { parseIncomingEvent, hashContactHandle } from "./privacy";
import { buildDescription, scoreEvent } from "./risk";
import {
  buildGameStatus,
  DEMO_CHILD_ID_FALLBACK,
  DEMO_CHILD_IDS,
  getDemoPresetForChild,
  isDemoGameId,
  listDemoPresetSummaries,
  type DemoPresetId,
  DEMO_PRESET_IDS
} from "./demoPresets";
import {
  boolToInt,
  dbSettingsToApi,
  parseSettingsPatch,
  type SettingsRow
} from "./settings";
import {
  DEFAULT_SETTINGS,
  type IncomingEvent,
  type RiskLevel,
  type SettingsApi
} from "./types";

type RuntimeEnv = Env & {
  DEMO_API_KEY?: string;
  DEMO_TRIGGER_KEY?: string;
  DEMO_PAGE_PASSWORD?: string;
};

type ChildRow = {
  id: string;
  displayName: string;
  ageBand: string;
};

type ChildGameRow = ChildRow & {
  currentGameId: string | null;
};

type AlertSummaryRow = {
  id: string;
  childId: string;
  platform: string;
  eventType: string;
  description: string;
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
  parentAction: string;
  createdAt: string;
  metadataJson: string;
  eventId: string | null;
  isParentVisible: number;
};

type AlertDetailRow = AlertSummaryRow & {
  contactHandleHash: string | null;
};

type CountRow = {
  riskLevel: RiskLevel;
  count: number;
};

type PublicAlertSummary = {
  id: string;
  childId: string;
  label: string;
  presetId?: string;
  description: string;
  platform: string;
  eventType: string;
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
  parentAction: string;
  date: string;
  createdAt: string;
  isParentVisible: boolean;
  eventId?: string;
  signals: string[];
  messageCount?: number;
  windowMinutes?: number;
};

type WorkerSignalInput = {
  childId?: unknown;
  eventId?: unknown;
  idempotencyKey?: unknown;
  presetId?: unknown;
  label?: unknown;
  description?: unknown;
  platform?: unknown;
  eventType?: unknown;
  riskLevel?: unknown;
  riskScore?: unknown;
  reason?: unknown;
  parentAction?: unknown;
  signals?: unknown;
  date?: unknown;
  createdAt?: unknown;
  contactHandleHash?: unknown;
  messageCount?: unknown;
  windowMinutes?: unknown;
  isParentVisible?: unknown;
};

const JSON_HEADERS = {
  "Content-Type": "application/json"
};
const DAILY_API_CALL_LIMIT = 5000;
const DEMO_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const WORKER_EVENT_ID_PATTERN = /^[a-zA-Z0-9_:-]{1,120}$/;
const WORKER_TOKEN_PATTERN = /^[a-zA-Z0-9_:-]{1,120}$/;
const PLATFORM_MOVE_PATTERN = /discord|snapchat|telegram|whatsapp/i;
type SettingsKey = keyof SettingsApi;

function allowedOrigins(env: RuntimeEnv): string[] {
  return (env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginMatch(pattern: string, requestOrigin: string): boolean {
  if (pattern === "*") {
    return true;
  }

  const wildcard = pattern.match(/^(https?:\/\/)\*\.(.+)$/);
  if (wildcard) {
    try {
      const originUrl = new URL(requestOrigin);
      const protocol = `${originUrl.protocol}//`;
      const hostname = originUrl.hostname.toLowerCase();
      const suffix = wildcard[2].toLowerCase();
      return protocol === wildcard[1] && hostname.endsWith(`.${suffix}`);
    } catch {
      return false;
    }
  }

  return requestOrigin === pattern;
}

function corsHeaders(request: Request, env: RuntimeEnv): HeadersInit {
  const requestOrigin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400"
  };

  if (
    requestOrigin &&
    allowed.some((allowedOrigin) =>
      isOriginMatch(allowedOrigin.toLowerCase(), requestOrigin.toLowerCase())
    )
  ) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
    headers.Vary = "Origin";
  }

  return headers;
}

function json(data: unknown, request: Request, env: RuntimeEnv, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(request, env),
      ...JSON_HEADERS
    }
  });
}

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(400, "Content-Type must be application/json");
  }

  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([sha256Bytes(left), sha256Bytes(right)]);
  return crypto.subtle.timingSafeEqual(leftHash, rightHash);
}

function extractBearerToken(request: Request): string | undefined {
  return request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")?.trim() || undefined;
}

async function requireAuth(request: Request, expected: string | undefined): Promise<void> {
  const provided = extractBearerToken(request);
  if (!expected || !provided || !(await timingSafeEqual(provided, expected))) {
    throw new HttpError(401, "Unauthorized");
  }
}

async function readDemoInput(request: Request): Promise<unknown> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {};
  }

  try {
    const body = await request.text();
    if (!body || body.trim() === "") {
      return {};
    }
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function parseMetadata(metadataJson: string): unknown {
  try {
    return JSON.parse(metadataJson);
  } catch {
    return {};
  }
}

function metadataRecord(metadataJson: string): Record<string, unknown> {
  const parsed = parseMetadata(metadataJson);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function metadataString(
  metadata: Record<string, unknown>,
  key: string
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metadataInteger(
  metadata: Record<string, unknown>,
  key: string
): number | undefined {
  const value = metadata[key];
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function metadataSignals(metadata: Record<string, unknown>): string[] {
  const value = metadata.signals;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((signal): signal is string => typeof signal === "string");
}

function publicLabelForAlert(
  row: AlertSummaryRow,
  metadata: Record<string, unknown>,
  presetId: string | undefined
): string {
  const storedLabel = metadataString(metadata, "label");
  if (storedLabel) {
    return storedLabel;
  }

  if (presetId && isDemoPresetId(presetId)) {
    return getDemoPresetForChild(row.childId, presetId).label;
  }

  return row.description;
}

function toPublicAlertSummary(row: AlertSummaryRow): PublicAlertSummary {
  const metadata = metadataRecord(row.metadataJson);
  const presetId = metadataString(metadata, "presetId");
  const eventId = row.eventId ?? metadataString(metadata, "eventId");
  const messageCount = metadataInteger(metadata, "messageCount");
  const windowMinutes = metadataInteger(metadata, "windowMinutes");

  return {
    id: row.id,
    childId: row.childId,
    label: publicLabelForAlert(row, metadata, presetId),
    ...(presetId ? { presetId } : {}),
    description: row.description,
    platform: row.platform,
    eventType: row.eventType,
    riskScore: row.riskScore,
    riskLevel: row.riskLevel,
    reason: row.reason,
    parentAction: row.parentAction,
    date: metadataString(metadata, "date") ?? row.createdAt,
    createdAt: metadataString(metadata, "createdAt") ?? row.createdAt,
    isParentVisible: row.isParentVisible !== 0,
    ...(eventId ? { eventId } : {}),
    signals: metadataSignals(metadata),
    ...(messageCount !== undefined ? { messageCount } : {}),
    ...(windowMinutes !== undefined ? { windowMinutes } : {})
  };
}

function isDemoPresetId(value: string): value is DemoPresetId {
  return (DEMO_PRESET_IDS as readonly string[]).includes(value);
}

function eventSettingsKeys(event: IncomingEvent): SettingsKey[] {
  const signals = new Set(event.signals ?? []);
  const highFrequency =
    (event.messageCount ?? 0) >= 15 && (event.windowMinutes ?? 999) <= 10;
  const settings = new Set<SettingsKey>();

  if (event.eventType === "personal_info" || signals.has("asks_personal_info")) {
    settings.add("personalInfo");
  }

  if (
    event.eventType === "unknown_messages" ||
    event.eventType === "gift_scam" ||
    highFrequency ||
    signals.has("high_frequency") ||
    signals.has("gift_scam") ||
    signals.has("robux") ||
    signals.has("skin_scam")
  ) {
    settings.add("unknownMessages");
  }

  if (
    event.eventType === "move_to_other_app" ||
    signals.has("move_to_other_app") ||
    event.eventType === "call_invite" ||
    signals.has("call_invite") ||
    event.eventType === "voice_call" ||
    signals.has("voice_call") ||
    PLATFORM_MOVE_PATTERN.test(event.description ?? "")
  ) {
    settings.add("moveToOtherApp");
  }

  if (event.eventType === "new_friend" || signals.has("new_contact")) {
    settings.add("newFriends");
  }

  return [...settings];
}

function isEventSuppressedBySettings(
  event: IncomingEvent,
  settings: SettingsApi,
  scored: { riskScore: number }
): boolean {
  return (
    scored.riskScore === 0 &&
    eventSettingsKeys(event).some((setting) => !settings[setting])
  );
}

function readDemoChildId(payload: unknown): string {
  if (payload === undefined || payload === null) {
    return DEMO_CHILD_ID_FALLBACK;
  }
  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "Demo trigger payload must be an object");
  }
  const body = payload as Record<string, unknown>;
  const requestedId = body.childId;
  if (requestedId === undefined) {
    return DEMO_CHILD_ID_FALLBACK;
  }
  if (typeof requestedId !== "string") {
    throw new HttpError(400, "childId must be a non-empty string");
  }
  const childId = requestedId.trim();
  if (!childId) {
    throw new HttpError(400, "childId must be a non-empty string");
  }
  if (!DEMO_ID_PATTERN.test(childId)) {
    throw new HttpError(400, "childId format is invalid");
  }
  return childId;
}

function readDemoChildIdQuery(url: URL): string {
  const requestedId = url.searchParams.get("childId");
  if (requestedId === null) {
    return DEMO_CHILD_ID_FALLBACK;
  }
  const childId = requestedId.trim();
  if (!childId) {
    throw new HttpError(400, "childId must be a non-empty string");
  }
  if (!DEMO_ID_PATTERN.test(childId)) {
    throw new HttpError(400, "childId format is invalid");
  }
  return childId;
}

function readGameStatusPatch(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "JSON body must be an object");
  }

  const body = value as Record<string, unknown>;
  const gameId = body.gameId;
  if (typeof gameId !== "string" || gameId.trim() === "") {
    throw new HttpError(400, "gameId is required");
  }
  if (!isDemoGameId(gameId.trim())) {
    throw new HttpError(400, "Unknown game");
  }
  return gameId.trim();
}

function readWorkerString(
  body: Record<string, unknown>,
  key: string,
  options: { required?: boolean; maxLength?: number; pattern?: RegExp } = {}
): string | undefined {
  const value = body[key];
  if (value === undefined) {
    if (options.required) {
      throw new HttpError(400, `${key} is required`);
    }
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${key} must be a non-empty string`);
  }

  const trimmed = value.trim();
  if (options.maxLength !== undefined && trimmed.length > options.maxLength) {
    throw new HttpError(400, `${key} is too long`);
  }
  if (options.pattern && !options.pattern.test(trimmed)) {
    throw new HttpError(400, `${key} format is invalid`);
  }

  return trimmed;
}

function readWorkerRiskLevel(value: unknown): RiskLevel {
  if (value === "Low" || value === "Medium" || value === "High") {
    return value;
  }
  throw new HttpError(400, "riskLevel must be Low, Medium, or High");
}

function readWorkerRiskScore(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100) {
    return value;
  }
  throw new HttpError(400, "riskScore must be an integer between 0 and 100");
}

function defaultRiskScore(riskLevel: RiskLevel): number {
  return riskLevel === "High" ? 90 : riskLevel === "Medium" ? 60 : 20;
}

function readWorkerSignals(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
    throw new HttpError(400, "signals must be a non-empty array with no more than 12 items");
  }

  return value.map((signal) => {
    if (typeof signal !== "string" || !WORKER_TOKEN_PATTERN.test(signal)) {
      throw new HttpError(400, "signals may only contain short metadata labels");
    }
    return signal;
  });
}

function readWorkerNumber(
  body: Record<string, unknown>,
  key: string
): number | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new HttpError(400, `${key} must be a non-negative integer`);
  }
  return value;
}

function readWorkerBoolean(
  body: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${key} must be a boolean`);
  }
  return value;
}

function readWorkerSignalBody(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "JSON body must be an object");
  }
  return value as Record<string, unknown>;
}

function readWorkerEventId(
  request: Request,
  body: Record<string, unknown>
): string {
  const headerKey = request.headers.get("Idempotency-Key")?.trim();
  const bodyEventId = readWorkerString(body, "eventId", {
    maxLength: 120,
    pattern: WORKER_EVENT_ID_PATTERN
  });
  const bodyIdempotencyKey = readWorkerString(body, "idempotencyKey", {
    maxLength: 120,
    pattern: WORKER_EVENT_ID_PATTERN
  });
  const eventId = bodyEventId ?? bodyIdempotencyKey ?? headerKey;

  if (!eventId || !WORKER_EVENT_ID_PATTERN.test(eventId)) {
    throw new HttpError(400, "worker signal event id is required");
  }
  if (headerKey && bodyEventId && headerKey !== bodyEventId) {
    throw new HttpError(400, "Idempotency-Key does not match eventId");
  }
  if (headerKey && bodyIdempotencyKey && headerKey !== bodyIdempotencyKey) {
    throw new HttpError(400, "Idempotency-Key does not match idempotencyKey");
  }

  return eventId;
}

async function ensureChildExists(env: RuntimeEnv, childId: string): Promise<void> {
  if (!(await childExists(env, childId))) {
    throw new HttpError(404, "Child not found");
  }
}

async function getSettingsRow(env: RuntimeEnv, childId: string): Promise<SettingsRow | null> {
  return env.DB.prepare(
    `
      SELECT
        new_friends,
        unknown_messages,
        personal_info,
        move_to_other_app
      FROM alert_settings
      WHERE child_id = ?
    `
  )
    .bind(childId)
    .first<SettingsRow>();
}

async function getSettingsData(env: RuntimeEnv, childId: string): Promise<SettingsApi> {
  const row = await getSettingsRow(env, childId);
  return row ? dbSettingsToApi(row) : DEFAULT_SETTINGS;
}

async function childExists(env: RuntimeEnv, childId: string): Promise<boolean> {
  const child = await env.DB.prepare("SELECT id FROM children WHERE id = ?")
    .bind(childId)
    .first<{ id: string }>();

  return child !== null;
}

async function incrementDailyApiCallCount(env: RuntimeEnv): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO daily_api_calls (
        call_date,
        call_count
      ) VALUES (?, 0)
    `
  )
    .bind(today)
    .run();

  const result = await env.DB.prepare(
    `
      UPDATE daily_api_calls
      SET
        call_count = call_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE call_date = ?
        AND call_count < ?
    `
  )
    .bind(today, DAILY_API_CALL_LIMIT)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

async function getDemoChildren(request: Request, env: RuntimeEnv): Promise<Response> {
  const rows = await getDemoChildRows(env);
  const children = rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    ageBand: row.ageBand,
    gameStatus: buildGameStatus(row.currentGameId ?? "roblox")
  }));

  return json({ children }, request, env);
}

async function getDemoChildRows(env: RuntimeEnv): Promise<ChildGameRow[]> {
  const placeholders = DEMO_CHILD_IDS.map(() => "?").join(", ");
  const rows = await env.DB.prepare(
    `
      SELECT
        c.id,
        c.display_name AS displayName,
        c.age_band AS ageBand,
        s.current_game_id AS currentGameId
      FROM children c
      LEFT JOIN child_game_status s ON s.child_id = c.id
      WHERE c.id IN (${placeholders})
    `
  )
    .bind(...DEMO_CHILD_IDS)
    .all<ChildGameRow>();

  const byId = new Map(rows.results.map((row) => [row.id, row]));
  return DEMO_CHILD_IDS
    .map((childId) => byId.get(childId))
    .filter((row): row is ChildGameRow => row !== undefined);
}

async function getDemoTerminalEvents(
  request: Request,
  env: RuntimeEnv
): Promise<Response> {
  const children = (await getDemoChildRows(env)).map((row) => ({
    childId: row.id,
    displayName: row.displayName,
    ageBand: row.ageBand,
    gameStatus: buildGameStatus(row.currentGameId ?? "roblox")
  }));
  const placeholders = DEMO_CHILD_IDS.map(() => "?").join(", ");
  const alertRows = await env.DB.prepare(
    `
      SELECT
        id,
        child_id AS childId,
        platform,
        event_type AS eventType,
        description,
        risk_score AS riskScore,
        risk_level AS riskLevel,
        reason,
        parent_action AS parentAction,
        created_at AS createdAt,
        metadata_json AS metadataJson,
        event_id AS eventId,
        is_parent_visible AS isParentVisible
      FROM risk_events
      WHERE child_id IN (${placeholders})
        AND is_parent_visible = 1
      ORDER BY created_at DESC, rowid DESC
      LIMIT 50
    `
  )
    .bind(...DEMO_CHILD_IDS)
    .all<AlertSummaryRow>();

  return json(
    {
      generatedAt: new Date().toISOString(),
      children,
      alerts: alertRows.results.map(toPublicAlertSummary)
    },
    request,
    env
  );
}

async function getDemoPresets(
  request: Request,
  env: RuntimeEnv,
  url: URL
): Promise<Response> {
  const childId = readDemoChildIdQuery(url);
  await ensureChildExists(env, childId);
  return json({ childId, presets: listDemoPresetSummaries(childId) }, request, env);
}

async function updateGameStatusRecord(
  request: Request,
  env: RuntimeEnv,
  childId: string
): Promise<Response> {
  await ensureChildExists(env, childId);
  const gameId = readGameStatusPatch(await readJson(request));

  await env.DB.prepare(
    `
      INSERT INTO child_game_status (
        child_id,
        current_game_id,
        updated_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(child_id) DO UPDATE SET
        current_game_id = excluded.current_game_id,
        updated_at = CURRENT_TIMESTAMP
    `
  )
    .bind(childId, gameId)
    .run();

  return json(
    {
      childId,
      gameStatus: buildGameStatus(gameId)
    },
    request,
    env
  );
}

async function updateDemoSessionGameStatus(
  request: Request,
  env: RuntimeEnv,
  childId: string
): Promise<Response> {
  if (!(await hasValidDemoSession(request, env))) {
    return json({ error: "Demo session required" }, request, env, 401);
  }

  return updateGameStatusRecord(request, env, childId);
}

async function getDashboard(
  request: Request,
  env: RuntimeEnv,
  childId: string
): Promise<Response> {
  const child = await env.DB.prepare(
    `
      SELECT
        c.id,
        c.display_name AS displayName,
        c.age_band AS ageBand,
        s.current_game_id AS currentGameId
      FROM children c
      LEFT JOIN child_game_status s ON s.child_id = c.id
      WHERE c.id = ?
    `
  )
    .bind(childId)
    .first<ChildGameRow>();

  if (!child) {
    return json({ error: "Child not found" }, request, env, 404);
  }
  const { currentGameId, ...childSummary } = child;

  const recent = await env.DB.prepare(
    `
      SELECT
        id,
        child_id AS childId,
        platform,
        event_type AS eventType,
        description,
        risk_score AS riskScore,
        risk_level AS riskLevel,
        reason,
        parent_action AS parentAction,
        created_at AS createdAt,
        metadata_json AS metadataJson,
        event_id AS eventId,
        is_parent_visible AS isParentVisible
      FROM risk_events
      WHERE child_id = ?
        AND is_parent_visible = 1
      ORDER BY created_at DESC
      LIMIT 5
    `
  )
    .bind(childId)
    .all<AlertSummaryRow>();

  const countRows = await env.DB.prepare(
    `
      SELECT
        risk_level AS riskLevel,
        COUNT(*) AS count
      FROM risk_events
      WHERE child_id = ?
        AND is_parent_visible = 1
      GROUP BY risk_level
    `
  )
    .bind(childId)
    .all<CountRow>();

  const counts: Record<RiskLevel, number> = { Low: 0, Medium: 0, High: 0 };
  for (const row of countRows.results) {
    counts[row.riskLevel] = row.count;
  }

  const riskLevel: RiskLevel =
    counts.High > 0 ? "High" : counts.Medium > 0 ? "Medium" : "Low";

  return json(
    {
      child: childSummary,
      childId,
      gameStatus: buildGameStatus(currentGameId ?? "roblox"),
      riskLevel,
      counts,
      recentAlerts: recent.results.map(toPublicAlertSummary)
    },
    request,
    env
  );
}

async function getAlerts(
  request: Request,
  env: RuntimeEnv,
  childId: string
): Promise<Response> {
  await ensureChildExists(env, childId);

  const rows = await env.DB.prepare(
    `
      SELECT
        id,
        child_id AS childId,
        platform,
        event_type AS eventType,
        description,
        risk_score AS riskScore,
        risk_level AS riskLevel,
        reason,
        parent_action AS parentAction,
        created_at AS createdAt,
        metadata_json AS metadataJson,
        event_id AS eventId,
        is_parent_visible AS isParentVisible
      FROM risk_events
      WHERE child_id = ?
        AND is_parent_visible = 1
      ORDER BY created_at DESC
      LIMIT 50
    `
  )
    .bind(childId)
    .all<AlertSummaryRow>();

  return json(
    {
      childId,
      alerts: rows.results.map(toPublicAlertSummary),
      generatedAt: new Date().toISOString()
    },
    request,
    env
  );
}

async function resetAlerts(
  request: Request,
  env: RuntimeEnv,
  childId: string
): Promise<Response> {
  await ensureChildExists(env, childId);

  const result = await env.DB.prepare(
    `
      DELETE FROM risk_events
      WHERE child_id = ?
    `
  )
    .bind(childId)
    .run();

  return json(
    {
      childId,
      reset: true,
      deletedAlerts: result.meta.changes ?? 0
    },
    request,
    env
  );
}

async function resetDemoSessionAlerts(
  request: Request,
  env: RuntimeEnv,
  childId: string
): Promise<Response> {
  if (!(await hasValidDemoSession(request, env))) {
    return json({ error: "Demo session required" }, request, env, 401);
  }

  return resetAlerts(request, env, childId);
}

async function getAlert(
  request: Request,
  env: RuntimeEnv,
  alertId: string
): Promise<Response> {
  const row = await env.DB.prepare(
    `
      SELECT
        id,
        child_id AS childId,
        platform,
        event_type AS eventType,
        contact_handle_hash AS contactHandleHash,
        description,
        risk_score AS riskScore,
        risk_level AS riskLevel,
        reason,
        parent_action AS parentAction,
        metadata_json AS metadataJson,
        event_id AS eventId,
        is_parent_visible AS isParentVisible,
        created_at AS createdAt
      FROM risk_events
      WHERE id = ?
    `
  )
    .bind(alertId)
    .first<AlertDetailRow>();

  if (!row) {
    return json({ error: "Alert not found" }, request, env, 404);
  }

  const { metadataJson, ...alert } = row;
  return json(
    {
      ...alert,
      metadata: parseMetadata(metadataJson)
    },
    request,
    env
  );
}

async function getSettings(
  request: Request,
  env: RuntimeEnv,
  childId: string
): Promise<Response> {
  await ensureChildExists(env, childId);

  return json({ settings: await getSettingsData(env, childId) }, request, env);
}

async function updateSettings(
  request: Request,
  env: RuntimeEnv,
  childId: string
): Promise<Response> {
  if (!(await childExists(env, childId))) {
    return json({ error: "Child not found" }, request, env, 404);
  }

  const current = await getSettingsData(env, childId);
  const next = parseSettingsPatch(await readJson(request), current);

  await env.DB.prepare(
    `
      INSERT INTO alert_settings (
        child_id,
        new_friends,
        unknown_messages,
        personal_info,
        move_to_other_app
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(child_id) DO UPDATE SET
        new_friends = excluded.new_friends,
        unknown_messages = excluded.unknown_messages,
        personal_info = excluded.personal_info,
        move_to_other_app = excluded.move_to_other_app
    `
  )
    .bind(
      childId,
      boolToInt(next.newFriends),
      boolToInt(next.unknownMessages),
      boolToInt(next.personalInfo),
      boolToInt(next.moveToOtherApp)
    )
    .run();

  return json({ settings: next }, request, env);
}

async function getTransparency(
  request: Request,
  env: RuntimeEnv,
  childId: string
): Promise<Response> {
  await ensureChildExists(env, childId);

  return json(
    {
      childId,
      settings: await getSettingsData(env, childId),
      parentsCanSee: [
        "risk level",
        "platform name",
        "event type",
        "reason something was flagged",
        "suggested parent action"
      ],
      parentsCannotSee: [
        "full private conversations",
        "passwords",
        "private account credentials",
        "unrelated message history"
      ]
    },
    request,
    env
  );
}

async function ingestEventRecord(
  env: RuntimeEnv,
  event: IncomingEvent,
  request: Request,
  demoContext?: {
    presetId: DemoPresetId;
    label: string;
    eventId?: string;
    isParentVisible?: boolean;
  }
): Promise<Response> {
  await ensureChildExists(env, event.childId);

  const settings = await getSettingsData(env, event.childId);
  const scored = scoreEvent(event, settings);
  if (isEventSuppressedBySettings(event, settings, scored)) {
    return json(
      {
        ...(demoContext
          ? {
              presetId: demoContext.presetId,
              label: demoContext.label
            }
          : {}),
        suppressed: true,
        reason: "Alert suppressed by child settings",
        childId: event.childId
      },
      request,
      env
    );
  }

  const contactHandleHash = event.contactHandle
    ? await hashContactHandle(event.contactHandle)
    : event.contactHandleHash ?? null;
  const id = crypto.randomUUID();
  const description = buildDescription(event);
  const metadata: Record<string, unknown> = {
    signals: event.signals ?? [],
    messageCount: event.messageCount ?? null,
    windowMinutes: event.windowMinutes ?? null
  };

  if (demoContext) {
    metadata.presetId = demoContext.presetId;
    metadata.label = demoContext.label;
    if (demoContext.eventId) {
      metadata.eventId = demoContext.eventId;
    }
  }
  metadata.isParentVisible = demoContext?.isParentVisible ?? true;

  await env.DB.prepare(
    `
      INSERT INTO risk_events (
        id,
        event_id,
        child_id,
        platform,
        event_type,
        contact_handle_hash,
        description,
        risk_score,
        risk_level,
        reason,
        parent_action,
        metadata_json,
        is_parent_visible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      id,
      demoContext?.eventId ?? null,
      event.childId,
      event.platform,
      event.eventType,
      contactHandleHash,
      description,
      scored.riskScore,
      scored.riskLevel,
      scored.reason,
      scored.parentAction,
      JSON.stringify(metadata),
      demoContext?.isParentVisible === false ? 0 : 1
    )
    .run();

  if (demoContext) {
    const created = await getAlertSummaryById(env, id);
    if (!created) {
      throw new HttpError(500, "Demo alert was not stored");
    }
    return json(toPublicAlertSummary(created), request, env, 201);
  }

  return json(
    {
      id,
      description,
      ...scored
    },
    request,
    env,
    201
  );
}

async function ingestDemoEvent(
  request: Request,
  env: RuntimeEnv,
  presetId: DemoPresetId
): Promise<Response> {
  const demoInput = await readDemoInput(request);
  const childId = readDemoChildId(demoInput);
  const preset = getDemoPresetForChild(childId, presetId);

  return ingestEventRecord(env, {
    ...preset.event,
    childId
  }, request, {
    presetId,
    label: preset.label
  });
}

async function ingestDemoSessionEvent(
  request: Request,
  env: RuntimeEnv,
  presetId: DemoPresetId
): Promise<Response> {
  if (!(await hasValidDemoSession(request, env))) {
    return json({ error: "Demo session required" }, request, env, 401);
  }

  return ingestDemoEvent(request, env, presetId);
}

async function getAlertSummaryByEventId(
  env: RuntimeEnv,
  childId: string,
  eventId: string
): Promise<AlertSummaryRow | null> {
  return env.DB.prepare(
    `
      SELECT
        id,
        child_id AS childId,
        platform,
        event_type AS eventType,
        description,
        risk_score AS riskScore,
        risk_level AS riskLevel,
        reason,
        parent_action AS parentAction,
        created_at AS createdAt,
        metadata_json AS metadataJson,
        event_id AS eventId,
        is_parent_visible AS isParentVisible
      FROM risk_events
      WHERE child_id = ?
        AND event_id = ?
      LIMIT 1
    `
  )
    .bind(childId, eventId)
    .first<AlertSummaryRow>();
}

async function getAlertSummaryById(
  env: RuntimeEnv,
  id: string
): Promise<AlertSummaryRow | null> {
  return env.DB.prepare(
    `
      SELECT
        id,
        child_id AS childId,
        platform,
        event_type AS eventType,
        description,
        risk_score AS riskScore,
        risk_level AS riskLevel,
        reason,
        parent_action AS parentAction,
        created_at AS createdAt,
        metadata_json AS metadataJson,
        event_id AS eventId,
        is_parent_visible AS isParentVisible
      FROM risk_events
      WHERE id = ?
      LIMIT 1
    `
  )
    .bind(id)
    .first<AlertSummaryRow>();
}

async function ingestWorkerSignal(request: Request, env: RuntimeEnv): Promise<Response> {
  await requireAuth(request, env.DEMO_TRIGGER_KEY);

  const body = readWorkerSignalBody(await readDemoInput(request)) as WorkerSignalInput &
    Record<string, unknown>;
  const childId = readDemoChildId(body);
  await ensureChildExists(env, childId);
  const eventId = readWorkerEventId(request, body);

  const existing = await getAlertSummaryByEventId(env, childId, eventId);
  if (existing) {
    return json(toPublicAlertSummary(existing), request, env);
  }

  const description = readWorkerString(body, "description", { required: true, maxLength: 240 });
  const label = readWorkerString(body, "label", { maxLength: 160 }) ?? description;
  const platform = readWorkerString(body, "platform", { required: true, maxLength: 40 });
  const eventType = readWorkerString(body, "eventType", {
    maxLength: 80,
    pattern: WORKER_TOKEN_PATTERN
  }) ?? "worker_signal";
  const reason = readWorkerString(body, "reason", { required: true, maxLength: 240 });
  const parentAction = readWorkerString(body, "parentAction", { required: true, maxLength: 360 });
  const riskLevel = readWorkerRiskLevel(body.riskLevel);
  const riskScore = body.riskScore === undefined
    ? defaultRiskScore(riskLevel)
    : readWorkerRiskScore(body.riskScore);
  const signals = readWorkerSignals(body.signals);
  const isParentVisible = readWorkerBoolean(body, "isParentVisible") ?? true;
  const contactHandleHash = readWorkerString(body, "contactHandleHash", { maxLength: 160 }) ?? null;
  const createdAt = readWorkerString(body, "createdAt", { maxLength: 80 });
  const date = readWorkerString(body, "date", { maxLength: 80 }) ?? createdAt;
  const presetId = readWorkerString(body, "presetId", {
    maxLength: 80,
    pattern: WORKER_TOKEN_PATTERN
  });
  const messageCount = readWorkerNumber(body, "messageCount");
  const windowMinutes = readWorkerNumber(body, "windowMinutes");
  const id = crypto.randomUUID();
  const metadata: Record<string, unknown> = {
    eventId,
    label,
    signals,
    isParentVisible
  };

  if (presetId) metadata.presetId = presetId;
  if (date) metadata.date = date;
  if (createdAt) metadata.createdAt = createdAt;
  if (messageCount !== undefined) metadata.messageCount = messageCount;
  if (windowMinutes !== undefined) metadata.windowMinutes = windowMinutes;

  await env.DB.prepare(
    `
      INSERT INTO risk_events (
        id,
        event_id,
        child_id,
        platform,
        event_type,
        contact_handle_hash,
        description,
        risk_score,
        risk_level,
        reason,
        parent_action,
        metadata_json,
        is_parent_visible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      id,
      eventId,
      childId,
      platform,
      eventType,
      contactHandleHash,
      description,
      riskScore,
      riskLevel,
      reason,
      parentAction,
      JSON.stringify(metadata),
      isParentVisible ? 1 : 0
    )
    .run();

  const created = await getAlertSummaryById(env, id);
  if (!created) {
    throw new HttpError(500, "Worker signal was not stored");
  }

  return json(toPublicAlertSummary(created), request, env, 201);
}

async function ingestEvent(request: Request, env: RuntimeEnv): Promise<Response> {
  const event = parseIncomingEvent(await readJson(request));
  return ingestEventRecord(env, event, request);
}

async function route(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const [api, resource, id] = parts;

  if (url.pathname === "/" && request.method === "GET") {
    return redirect("/demo");
  }

  if (url.pathname === "/demo" && request.method === "GET") {
    return getDemoPage(request, env);
  }

  if (url.pathname === "/demo/login" && request.method === "POST") {
    return loginDemo(request, env);
  }

  if (url.pathname === "/demo/logout" && request.method === "POST") {
    return logoutDemo();
  }

  if (api !== "api") {
    return json({ error: "Not found" }, request, env, 404);
  }

  if (resource === "health" && request.method === "GET" && parts.length === 2) {
    return json({ ok: true, service: "bumper-api" }, request, env);
  }

  if (resource === "dashboard" && request.method === "GET" && id && parts.length === 3) {
    return getDashboard(request, env, id);
  }

  if (resource === "alerts" && request.method === "GET" && id && parts.length === 3) {
    return getAlerts(request, env, id);
  }

  if (resource === "alerts" && request.method === "POST" && id && parts[3] === "reset" && parts.length === 4) {
    await requireAuth(request, env.DEMO_API_KEY);
    return resetAlerts(request, env, id);
  }

  if (resource === "alert" && request.method === "GET" && id && parts.length === 3) {
    return getAlert(request, env, id);
  }

  if (resource === "settings" && request.method === "GET" && id && parts.length === 3) {
    return getSettings(request, env, id);
  }

  if (resource === "settings" && request.method === "PATCH" && id && parts.length === 3) {
    await requireAuth(request, env.DEMO_API_KEY);
    return updateSettings(request, env, id);
  }

  if (resource === "game-status" && request.method === "PATCH" && id && parts.length === 3) {
    await requireAuth(request, env.DEMO_API_KEY);
    return updateGameStatusRecord(request, env, id);
  }

  if (resource === "transparency" && request.method === "GET" && id && parts.length === 3) {
    return getTransparency(request, env, id);
  }

  if (
    resource === "worker" &&
    request.method === "POST" &&
    id === "signals" &&
    parts.length === 3
  ) {
    return ingestWorkerSignal(request, env);
  }

  if (resource === "events" && request.method === "POST" && parts.length === 2) {
    await requireAuth(request, env.DEMO_API_KEY);
    return ingestEvent(request, env);
  }

  if (
    resource === "demo" &&
    request.method === "GET" &&
    id === "terminal-events" &&
    parts.length === 3 &&
    !parts[3]
  ) {
    return getDemoTerminalEvents(request, env);
  }

  if (
    resource === "demo" &&
    request.method === "GET" &&
    id === "presets" &&
    parts.length === 3 &&
    !parts[3]
  ) {
    return getDemoPresets(request, env, url);
  }

  if (
    resource === "demo" &&
    request.method === "GET" &&
    id === "children" &&
    parts.length === 3 &&
    !parts[3]
  ) {
    return getDemoChildren(request, env);
  }

  if (
    resource === "demo" &&
    request.method === "PATCH" &&
    id === "session" &&
    parts[3] === "game-status" &&
    parts.length === 5
  ) {
    return updateDemoSessionGameStatus(request, env, parts[4]);
  }

  if (
    resource === "demo" &&
    request.method === "POST" &&
    id === "session" &&
    parts[3] === "alerts" &&
    parts[5] === "reset" &&
    parts.length === 6
  ) {
    return resetDemoSessionAlerts(request, env, parts[4]);
  }

  if (
    resource === "demo" &&
    request.method === "POST" &&
    id === "session" &&
    parts[3] === "events" &&
    parts.length === 5
  ) {
    const presetId = parts[4];
    if (!isDemoPresetId(presetId)) {
      return json({ error: "Demo preset not found" }, request, env, 404);
    }
    return ingestDemoSessionEvent(request, env, presetId);
  }

  if (
    resource === "demo" &&
    request.method === "POST" &&
    id === "events" &&
    parts.length === 4
  ) {
    await requireAuth(request, env.DEMO_TRIGGER_KEY);
    const presetId = parts[3];
    if (!isDemoPresetId(presetId)) {
      return json({ error: "Demo preset not found" }, request, env, 404);
    }
    return ingestDemoEvent(request, env, presetId);
  }

  return json({ error: "Not found" }, request, env, 404);
}

export default {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    try {
      const url = new URL(request.url);
      if (
        request.method !== "OPTIONS" &&
        url.pathname.startsWith("/api/") &&
        !(await incrementDailyApiCallCount(env))
      ) {
        return json({ error: "Daily API call limit exceeded" }, request, env, 429);
      }

      return await route(request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, request, env, error.status);
      }

      return json({ error: "Unexpected error" }, request, env, 500);
    }
  }
} satisfies ExportedHandler<RuntimeEnv>;
