# Frontend Technical Sheet

This sheet describes how a frontend should implement the Bumper demo children, game status controls, and supported alert flows against the Worker API.

Browser API calls are same-origin. The Lovable app should call `/api/*` paths
from the browser; the Lovable app's `src/server.ts` proxies those requests to
the backend configured by `BACKEND_API_BASE_URL`. Configure the frontend demo
control link to point at the external Worker-hosted demo page, for example:

```text
https://bumper-api.example.workers.dev/demo
```

For local development, set `BACKEND_API_BASE_URL` to the local Wrangler URL,
usually:

```text
http://127.0.0.1:8787
```

## Bootstrap flow

Recommended first-load sequence:

1. Optional connectivity check: `GET /api/health`.
2. Fetch demo kids: `GET /api/demo/children`.
3. Pick a default child from the returned `children` array.
4. Fetch child-specific trigger buttons: `GET /api/demo/presets?childId=<selectedChildId>`.
5. Fetch summary state: `GET /api/dashboard/<selectedChildId>`.
6. Fetch feed state: `GET /api/alerts/<selectedChildId>`.

On child switch, repeat steps 4-6 for the new child.

Every non-`OPTIONS` `/api/*` request counts toward the 5,000-call UTC daily cap, so keep polling modest.

## Frontend data model

Keep these IDs as stable state keys. Display names and labels should come from the API response, not from hard-coded UI strings.

```ts
type DemoChildId = "child_alex" | "child_maya" | "child_jordan";
type DemoGameId = "roblox" | "fortnite" | "apex_legends" | "valorant" | "overwatch_2";
type RiskLevel = "Low" | "Medium" | "High";
```

Recommended client state:

```ts
type FrontendState = {
  children: DemoChild[];
  selectedChildId: DemoChildId;
  presets: DemoPreset[];
  dashboard: Dashboard | null;
  alerts: AlertSummary[];
};
```

Use `selectedChildId` as the single source of truth for child-scoped requests. When the selected child changes, refetch presets, dashboard, and alerts for that child.

## Demo children

Fetch the children from:

```http
GET /api/demo/children
```

The backend currently seeds these three demo kids:

| Child ID | Display name | Age band | Initial game |
| --- | --- | --- | --- |
| `child_alex` | Alex | teen | Roblox |
| `child_maya` | Maya | teen | Fortnite |
| `child_jordan` | Jordan | teen | Apex Legends |

Each child response includes `gameStatus`:

```json
{
  "id": "child_maya",
  "displayName": "Maya",
  "ageBand": "teen",
  "gameStatus": {
    "currentGame": {
      "id": "fortnite",
      "label": "Fortnite",
      "rating": "PG-13"
    },
    "availableGames": [
      { "id": "roblox", "label": "Roblox", "rating": "All Ages" },
      { "id": "fortnite", "label": "Fortnite", "rating": "PG-13" },
      { "id": "apex_legends", "label": "Apex Legends", "rating": "PG-13" },
      { "id": "valorant", "label": "Valorant", "rating": "PG-13" },
      { "id": "overwatch_2", "label": "Overwatch 2", "rating": "PG-13" }
    ]
  }
}
```

## Game statuses

All three kids support the same five selectable games:

| Game ID | Label | Rating |
| --- | --- | --- |
| `roblox` | Roblox | All Ages |
| `fortnite` | Fortnite | PG-13 |
| `apex_legends` | Apex Legends | PG-13 |
| `valorant` | Valorant | PG-13 |
| `overwatch_2` | Overwatch 2 | PG-13 |

Read the selected game from either:

```http
GET /api/demo/children
GET /api/dashboard/:childId
```

The dashboard response includes the same `gameStatus` object as the child list.

Updating game status does not create, delete, or change alerts. It only updates the selected game shown for that child.

To change a game status from the Worker-hosted `/demo` page, use the session-cookie endpoint:

```http
PATCH /api/demo/session/game-status/:childId
Content-Type: application/json

{ "gameId": "valorant" }
```

The same-origin frontend changes game status with `PATCH /api/game-status/:childId`.
`src/server.ts` forwards the request to the backend Worker with the server-side
`DEMO_API_KEY`; browser code must not contain that key.

## Auth modes

| Flow | Endpoints | Frontend guidance |
| --- | --- | --- |
| Same-origin public reads | `GET /api/demo/children`, `GET /api/demo/presets`, `GET /api/demo/terminal-events`, `GET /api/dashboard/:childId`, `GET /api/alerts/:childId`, `GET /api/alert/:alertId`, `GET /api/settings/:childId`, `GET /api/transparency/:childId` | Browser calls `/api/*`; the frontend server proxies to `BACKEND_API_BASE_URL` |
| Same-origin demo mutations | `POST /api/demo/events/:presetId`, `POST /api/worker/signals` | Browser or trusted app calls same-origin `/api/*`; the frontend server injects `DEMO_TRIGGER_KEY` |
| Same-origin admin mutations | `PATCH /api/settings/:childId`, `PATCH /api/game-status/:childId`, `POST /api/alerts/:childId/reset` | Browser calls same-origin `/api/*`; the frontend server injects `DEMO_API_KEY` |
| Worker-hosted demo session | `/demo/login`, `POST /api/demo/session/events/:presetId`, `PATCH /api/demo/session/game-status/:childId`, `POST /api/demo/session/alerts/:childId/reset` | Use only from the Worker-served `/demo` control page with the HttpOnly `bumper_demo_session` cookie |

Session endpoints are not cross-origin Lovable endpoints. The Lovable app should use the same-origin proxy paths above.

## Supported trigger alerts

Fetch button metadata for the selected child:

```http
GET /api/demo/presets?childId=child_maya
```

Each child receives six trigger alerts. Preset IDs stay the same across children, but labels and descriptions are child-scoped, for example `Maya: Roblox gift or Robux scam lure`.

| Preset ID | Base alert label | Game | Event type | Setting family | Expected risk |
| --- | --- | --- | --- | --- | --- |
| `roblox_discord_move` | Roblox unknown user asks to move to Discord | Roblox | `unknown_messages` | `unknownMessages` | High |
| `personal_info_request` | Roblox player asks for personal info | Roblox | `personal_info` | `personalInfo` | Medium |
| `unknown_party_invite` | Fortnite party invite from unknown player | Fortnite | `new_friend` | `newFriends` | Low |
| `private_call_invite` | Fortnite private call invite | Fortnite | `call_invite` | `moveToOtherApp` | High |
| `rapid_messages` | Apex Legends rapid repeat messages | Apex Legends | `unknown_messages` | `unknownMessages` | Medium |
| `gift_scam` | Roblox gift or Robux scam lure | Roblox | `gift_scam` | `unknownMessages` | Medium |

Child-specific differences:

| Child | Label behavior | `gift_scam` variant | `rapid_messages` variant |
| --- | --- | --- | --- |
| Alex | Labels begin with `Alex:` | 3 messages in 20 minutes | 18 messages in 10 minutes |
| Maya | Labels begin with `Maya:` | 4 messages in 18 minutes | 16 messages in 8 minutes |
| Jordan | Labels begin with `Jordan:` | 5 messages in 15 minutes | 20 messages in 9 minutes |

Other presets use the same event metadata across children, with child-specific labels and descriptions.

## How alerts are received

There is no websocket, push, or server-sent event stream. The frontend receives alerts through normal HTTP responses.

Primary read endpoints:

```http
GET /api/dashboard/:childId
GET /api/alerts/:childId
GET /api/alert/:alertId
GET /api/demo/terminal-events
```

Use `GET /api/dashboard/:childId` for summary cards:

```ts
type Dashboard = {
  child: {
    id: string;
    displayName: string;
    ageBand: string;
  };
  gameStatus: {
    currentGame: DemoGame;
    availableGames: DemoGame[];
  };
  riskLevel: RiskLevel;
  counts: {
    Low: number;
    Medium: number;
    High: number;
  };
  recentAlerts: AlertSummary[];
};
```

Use `GET /api/alerts/:childId` for the alert feed:

```ts
type AlertSummary = {
  id: string | number;
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
```

The alert id field is `id: string | number` because the deployed backend uses UUIDs while some local demo helpers still use numeric ids.

`GET /api/dashboard/:childId` and `GET /api/alerts/:childId` should be fetched
on every refresh. The dashboard returns the latest 5 alerts in `recentAlerts`;
`/api/alerts/:childId` returns `{ childId, alerts, generatedAt }` for the full
feed, up to 50 alerts.

`GET /api/demo/terminal-events` returns `{ generatedAt, children, alerts }` across the three demo kids. It is primarily for the Windows terminal receiver and other demo-monitoring tools, not normal in-app rendering.

Use `GET /api/alert/:alertId` when opening a detail view. Detail responses include `childId`, `contactHandleHash`, and sanitized metadata such as `signals`, `messageCount`, and `windowMinutes`.

Recommended refresh behavior:

1. On app load, call `GET /api/demo/children`.
2. Select a default child, usually the first returned child.
3. Call `GET /api/demo/presets?childId=<selectedChildId>`.
4. Call `GET /api/dashboard/:childId` and `GET /api/alerts/:childId`.
5. After triggering or resetting alerts, refetch dashboard and alerts.
6. During demos, optional polling every 5-15 seconds is enough. Stop polling when the tab is hidden.

When changing child selection, use an `AbortController` or a request token so stale responses for the previous child cannot overwrite the currently selected child's dashboard.

CORS headers are returned only for origins configured in `ALLOWED_ORIGIN`. A request can still succeed from non-browser clients, but browser JavaScript can only read responses from allowed origins.

## Terminal receiver

Use `receive-demo-triggers.bat` from a Windows terminal during demos when you want to see that `/demo` page button presses reached the backend.

```bat
receive-demo-triggers.bat
receive-demo-triggers.bat http://127.0.0.1:8787 2
receive-demo-triggers.bat https://bumper-api.<account>.workers.dev 3
```

The script polls `GET /api/demo/terminal-events`, stores the startup state, then prints new alert triggers and game changes only. It does not need the demo page cookie, `DEMO_TRIGGER_KEY`, or `DEMO_API_KEY`. Stop it with `Ctrl+C`.

## Triggering demo alerts

Worker-hosted `/demo` page:

```http
POST /api/demo/session/events/:presetId
Content-Type: application/json

{ "childId": "child_maya" }
```

This endpoint requires the `bumper_demo_session` HttpOnly cookie created by `/demo/login`.

Same-origin frontend:

```http
POST /api/demo/events/:presetId
Content-Type: application/json

{ "childId": "child_maya" }
```

The browser never sends `DEMO_TRIGGER_KEY` or `DEMO_API_KEY`.
The frontend server proxy injects `DEMO_TRIGGER_KEY` for demo preset mutations and worker signal ingestion.
The frontend server proxy injects `DEMO_API_KEY` for admin mutations such as alert reset, settings, and game-status updates.

Successful trigger response:

```json
{
  "id": "generated-alert-id",
  "presetId": "gift_scam",
  "label": "Maya: Roblox gift or Robux scam lure",
  "childId": "child_maya",
  "description": "Roblox: gift scam (4 messages in 18 minutes)",
  "riskScore": 45,
  "riskLevel": "Medium",
  "reason": "gift/scam lure",
  "parentAction": "Talk to the child calmly before blocking or reporting..."
}
```

If a child setting suppresses the preset, no alert is created:

```json
{
  "presetId": "rapid_messages",
  "label": "Alex: Apex Legends rapid repeat messages",
  "suppressed": true,
  "reason": "Alert suppressed by child settings",
  "childId": "child_alex"
}
```

The frontend should handle both cases. For `suppressed: true`, show a neutral status message and do not add a new alert card locally.

## Worker signal sync

Use `POST /api/worker/signals` only from a same-origin proxy, trusted local bridge, or Worker. It accepts sanitized metadata and creates an idempotent alert that appears in dashboard, alert feed, and terminal receiver reads.

```http
POST /api/worker/signals
Content-Type: application/json
Idempotency-Key: worker-signal-1
```

The frontend server proxy injects `Authorization: Bearer <DEMO_TRIGGER_KEY>`.

```json
{
  "childId": "child_maya",
  "label": "Maya: unknown Roblox account shared an external link",
  "description": "Unknown Roblox account shared an external link",
  "platform": "Roblox",
  "eventType": "unknown_link",
  "riskLevel": "Medium",
  "riskScore": 68,
  "reason": "A new contact sent a link before there was any trusted context.",
  "parentAction": "Ask Maya whether she knows this person before opening the link.",
  "signals": ["new_contact"],
  "contactHandleHash": "anon-worker-signal",
  "isParentVisible": true
}
```

An event id is required via the `Idempotency-Key` header, body `eventId`, or body `idempotencyKey`. Reusing the same `(childId, eventId)` returns the existing alert instead of creating a duplicate. `label` defaults to `description`; `riskScore` defaults from `riskLevel` if omitted.

## Resetting alerts

Worker-hosted `/demo` page:

```http
POST /api/demo/session/alerts/:childId/reset
```

Same-origin frontend:

```http
POST /api/alerts/:childId/reset
```

Successful response:

```json
{
  "childId": "child_maya",
  "reset": true,
  "deletedAlerts": 1
}
```

After reset, refetch dashboard and alerts for the same child.

## Privacy constraints

The frontend must not send or display raw private conversations.

Allowed alert metadata:

- child id
- platform/game name
- event type
- risk signals
- message count and time window
- anonymized contact hash
- backend-generated description, reason, and parent action

Do not send:

- full message text
- screenshots of conversations
- passwords, tokens, cookies, or platform credentials
- raw contact handles unless using `POST /api/events` from a trusted backend, where the Worker hashes them before storage

The Worker stores derived metadata descriptions, not the raw `description` text submitted by clients.

## Error handling

| Status | Cause | Frontend behavior |
| --- | --- | --- |
| `400` | Invalid JSON, invalid `childId`, unknown `gameId`, private-content rejection | Show a validation message and keep current state |
| `401` | Missing or wrong bearer token, missing demo session | Send user to login or disable mutation control |
| `404` | Unknown child, alert, or preset | Show not found and refetch child/preset lists |
| `429` | Daily `/api/` call cap reached | Stop polling and show a retry-later message |
| `500` | Unexpected Worker error | Show generic error and allow manual retry |

All JSON error responses use:

```json
{
  "error": "Human-readable error"
}
```

## Implementation checklist

- Fetch children from `GET /api/demo/children`; do not hard-code only Alex.
- Render one selector for Alex, Maya, and Jordan.
- Render game choices from `gameStatus.availableGames`.
- Fetch presets with the selected child id.
- Send `{ "childId": selectedChildId }` when triggering a preset.
- Refresh dashboard and alerts after triggers, game changes, and resets.
- Use `receive-demo-triggers.bat` or `GET /api/demo/terminal-events` for terminal demo monitoring.
- Protect against stale child-switch responses.
- Do not store `DEMO_TRIGGER_KEY` or `DEMO_API_KEY` in browser code.
- Do not render or collect private message content.
