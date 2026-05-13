# Bumper Worker API

This project is a simple Cloudflare Worker API for the Bumper prototype. It is designed for a Lovable prototype or Android APK to ping a deployed Worker over HTTPS and read demo dashboard data.

For frontend implementation details, including the three demo kids, game status controls, supported trigger alerts, and alert refresh flow, see [Frontend Technical Sheet](./frontend-technical-sheet.md).

## Privacy Model

Bumper stores risk-event metadata, not private conversations.

Allowed event data:

- child profile id
- platform name
- event type
- risk signals such as `new_contact` or `move_to_other_app`
- message counts and time windows
- hashed or anonymized contact handles
- short risk-event descriptions derived by the Worker from metadata

Rejected event data:

- full message text
- full private conversations
- passwords
- tokens
- cookies
- platform credentials
- unrelated message history

Alerts are prompts for a parent-child conversation, not proof of wrongdoing.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Redirect to the password-gated browser demo |
| `GET` | `/demo` | Demo page password session | Browser page with preset buttons, dashboard, and alerts |
| `POST` | `/demo/login` | Demo page password | Create an HttpOnly demo session cookie |
| `POST` | `/demo/logout` | Public | Clear the demo session cookie if present |
| `GET` | `/api/health` | Public | Health check for APK/Lovable connectivity |
| `GET` | `/api/dashboard/:childId` | Public | Child status, latest alerts, and risk counts |
| `GET` | `/api/alerts/:childId` | Public | Child-scoped risk-event feed |
| `POST` | `/api/alerts/:childId/reset` | Bearer demo key | Delete all alerts for one child |
| `GET` | `/api/alert/:alertId` | Public | Alert detail with metadata and suggested action |
| `GET` | `/api/settings/:childId` | Public | Alert toggles for one child |
| `PATCH` | `/api/settings/:childId` | Bearer demo key | Update alert toggles |
| `GET` | `/api/demo/children` | Public | List the three demo kids and their current selectable game status |
| `GET` | `/api/demo/presets` | Public | List fixed frontend demo buttons and expected risk levels |
| `GET` | `/api/demo/terminal-events` | Public | Aggregate demo game status and visible alert feed for the Windows terminal receiver |
| `PATCH` | `/api/game-status/:childId` | Bearer demo key | Set the selected game status for one child |
| `PATCH` | `/api/demo/session/game-status/:childId` | Demo page password session | Set selected game status from a password-gated browser demo |
| `POST` | `/api/demo/session/alerts/:childId/reset` | Demo page password session | Reset alerts from the Worker-served browser demo |
| `POST` | `/api/demo/session/events/:presetId` | Demo page password session | Trigger one preset from the Worker-served browser page |
| `POST` | `/api/demo/events/:presetId` | Bearer demo trigger key | Trigger one preset event quickly from a button demo |
| `POST` | `/api/worker/signals` | Bearer demo trigger key | Ingest idempotent signal payloads from the Lovable proxy or a trusted Worker |
| `POST` | `/api/events` | Bearer demo key | Ingest sanitized mock risk events |
| `GET` | `/api/transparency/:childId` | Public | Child-facing transparency copy |
| `OPTIONS` | Any API path | Public | CORS preflight |

General mutation requests for raw event ingestion and settings updates require:

```http
Authorization: Bearer <DEMO_API_KEY>
Content-Type: application/json
```

Keep `DEMO_API_KEY` as a Cloudflare secret. Do not ship it inside Lovable frontend code or a production APK. For hackathon demo use, treat it as a low-trust gate only.

API requests under `/api/` are capped at 5,000 calls per UTC day. CORS preflight requests are not counted. When the cap is reached, the Worker returns:

```json
{
  "error": "Daily API call limit exceeded"
}
```

Demo-only trigger calls use a separate low-trust key:

```http
Authorization: Bearer <DEMO_TRIGGER_KEY>
```

`DEMO_TRIGGER_KEY` should be scoped to demo preset triggers and trusted worker-signal ingestion. In the Lovable app it is injected by the same-origin frontend server proxy, not by browser code. It cannot call raw `POST /api/events`, settings mutations, alert reset, or game-status mutation.

The Worker also serves a password-gated demo page at `/demo`. The page uses the session-cookie endpoints to load the three demo kids, switch game status, fetch child-specific trigger presets, and refresh the selected child's dashboard and alerts without exposing bearer keys. Configure it with:

```http
DEMO_PAGE_PASSWORD=<strong demo page password>
```

When login succeeds, the Worker sets a `bumper_demo_session` cookie with `HttpOnly`, `Secure`, and `SameSite=Lax`. The in-page buttons call `POST /api/demo/session/events/:presetId` and `POST /api/demo/session/alerts/:childId/reset`, so browser JavaScript does not receive `DEMO_TRIGGER_KEY`.

## Windows demo receiver

Run `receive-demo-triggers.bat` in a terminal to watch the Worker-hosted `/demo` buttons come through while presenting. The receiver polls the public aggregate feed and does not need demo cookies or bearer keys.

```bat
receive-demo-triggers.bat
receive-demo-triggers.bat http://127.0.0.1:8787 2
receive-demo-triggers.bat https://bumper-api.<account>.workers.dev 3
```

The first argument is the Worker base URL. If omitted, the script uses `BUMPER_DEMO_URL`, then falls back to `http://127.0.0.1:8787`. The second argument is the polling interval in seconds and falls back to `BUMPER_DEMO_INTERVAL_SECONDS`, then `2`.

The receiver reads:

```http
GET /api/demo/terminal-events
```

The response includes `generatedAt`, the three demo children with `gameStatus`, and up to 50 visible alert summaries across the demo kids. The script records the startup state, then prints only new trigger alerts and game changes after startup. Stop it with `Ctrl+C`.

## Worker signal sync

Use `POST /api/worker/signals` when a local game worker or demo bridge already has sanitized metadata and needs to create a parent-visible alert without sending private messages.

```http
POST /api/worker/signals
Authorization: Bearer <DEMO_TRIGGER_KEY>
Content-Type: application/json
Idempotency-Key: worker-signal-1
```

Example body for a new signal:

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

The event id is required through the `Idempotency-Key` header, body `eventId`, or body `idempotencyKey`. If both header and body ids are sent, they must match. The first `(childId, eventId)` insert returns `201`; duplicates return the existing alert with `200`.

Required body fields are `description`, `platform`, `riskLevel`, `reason`, `parentAction`, and `signals`. `childId` defaults to `child_alex` if omitted. Optional fields are `label`, `riskScore`, `presetId`, `date`, `createdAt`, `messageCount`, and `windowMinutes`. `label` defaults to `description`; `riskScore` defaults from `riskLevel`; `eventType` defaults to `worker_signal`; `isParentVisible` defaults to `true`.

## Example Event Ingestion

```bash
curl -X POST "https://bumper-api.<account>.workers.dev/api/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEMO_API_KEY" \
  -d '{
    "childId": "child_alex",
    "platform": "Roblox",
    "eventType": "unknown_messages",
    "contactHandle": "CoolUser#123",
    "messageCount": 18,
    "windowMinutes": 10,
    "signals": ["new_contact", "high_frequency", "move_to_other_app"],
    "description": "Unknown user sent many messages and asked to move to Discord"
  }'
```

The Worker hashes `contactHandle` before storage and never returns the raw handle. If a client sends `contactHandleHash` directly, it must already be anonymized as `anon-*` or formatted as `sha256:<64 lowercase hex characters>`.

The Worker does not persist the submitted `description` verbatim. It validates the field for obvious private-content patterns, can use it as a scoring hint, and stores a derived metadata description such as `Roblox: unknown messages (18 messages in 10 minutes)`.

## Demo children and game status

The backend seeds three demo children:

| Child ID | Display name | Age band | Initial game status |
| --- | --- | --- | --- |
| `child_alex` | Alex | teen | `roblox` |
| `child_maya` | Maya | teen | `fortnite` |
| `child_jordan` | Jordan | teen | `apex_legends` |

The frontend can discover these children and game choices from:

```http
GET /api/demo/children
```

Each child includes a `gameStatus` object:

```json
{
  "currentGame": {
    "id": "roblox",
    "label": "Roblox",
    "rating": "All Ages"
  },
  "availableGames": [
    { "id": "roblox", "label": "Roblox", "rating": "All Ages" },
    { "id": "fortnite", "label": "Fortnite", "rating": "PG-13" },
    { "id": "apex_legends", "label": "Apex Legends", "rating": "PG-13" },
    { "id": "valorant", "label": "Valorant", "rating": "PG-13" },
    { "id": "overwatch_2", "label": "Overwatch 2", "rating": "PG-13" }
  ]
}
```

External clients can set one child's current game status with the demo API key:

```http
PATCH /api/game-status/child_maya
Authorization: Bearer <DEMO_API_KEY>
Content-Type: application/json

{ "gameId": "valorant" }
```

Password-gated browser demo clients can use the session-cookie endpoint instead:

```http
PATCH /api/demo/session/game-status/child_maya
Content-Type: application/json

{ "gameId": "valorant" }
```

`GET /api/dashboard/:childId` also returns the same `gameStatus` object next to the existing `child`, `riskLevel`, `counts`, and `recentAlerts` fields.

## Reset alerts

Resetting alerts deletes that child's rows from `risk_events`. It does not delete the child profile, settings, or selected game status.

External demo clients reset alerts with the demo API key:

```http
POST /api/alerts/child_alex/reset
Authorization: Bearer <DEMO_API_KEY>
```

Password-gated browser demo clients use the session-cookie endpoint:

```http
POST /api/demo/session/alerts/child_alex/reset
```

Successful response:

```json
{
  "childId": "child_alex",
  "reset": true,
  "deletedAlerts": 1
}
```

## Public alert summaries

Dashboard, alert-feed, demo-trigger, and worker-signal responses expose the same parent-safe alert shape:

```ts
type AlertSummary = {
  id: string;
  childId: string;
  label: string;
  presetId?: string;
  description: string;
  platform: string;
  eventType: string;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
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

`GET /api/dashboard/:childId` returns this shape in `recentAlerts`. `GET /api/alerts/:childId` returns:

```json
{
  "childId": "child_maya",
  "alerts": [],
  "generatedAt": "2026-05-13T00:00:00.000Z"
}
```

## Demo presets

The frontend can fetch button metadata from:

```http
GET /api/demo/presets
```

For child-specific labels and event variants, pass the selected child:

```http
GET /api/demo/presets?childId=child_maya
```

The dashboard can then present one button per fixed scenario by calling:

```http
POST /api/demo/events/:presetId
```

Each selected child receives six unique trigger-alert labels. Preset IDs stay stable across children so the frontend can keep one button layout and swap the selected `childId`.

Supported presets:

| Preset ID | Base button label | Game | Setting family | Expected risk |
| --- | --- | --- | --- | --- |
| `roblox_discord_move` | Roblox unknown user asks to move to Discord | Roblox | `unknownMessages` | High |
| `personal_info_request` | Roblox player asks for personal info | Roblox | `personalInfo` | Medium |
| `unknown_party_invite` | Fortnite party invite from unknown player | Fortnite | `newFriends` | Low |
| `private_call_invite` | Fortnite private call invite | Fortnite | `moveToOtherApp` | High |
| `rapid_messages` | Apex Legends rapid repeat messages | Apex Legends | `unknownMessages` | Medium |
| `gift_scam` | Roblox gift or Robux scam lure | Roblox | `unknownMessages` | Medium |

Request body is optional for browser tests. If omitted, the demo defaults to `child_alex`. To target another child, pass:

```json
{
  "childId": "child_alex"
}
```

Response for successful insertion:

```json
{
  "id": "uuid",
  "presetId": "roblox_discord_move",
  "label": "Alex: Roblox unknown user asks to move to Discord",
  "childId": "child_alex",
  "description": "Roblox: unknown messages (18 messages in 10 minutes)",
  "riskScore": 100,
  "riskLevel": "High",
  "reason": "new contact + high message frequency + asked to move conversation to another app + another platform was mentioned",
  "parentAction": "Talk to the child calmly before blocking or reporting...",
  "date": "2026-05-13 00:00:00",
  "createdAt": "2026-05-13 00:00:00",
  "isParentVisible": true,
  "signals": ["new_contact", "high_frequency", "move_to_other_app"],
  "messageCount": 18,
  "windowMinutes": 10
}
```

`GET /api/demo/presets?childId=child_maya` returns `{ "childId": "child_maya", "presets": [...] }`.

If the event is suppressed by child settings, response is:

```json
{
  "presetId": "rapid_messages",
  "label": "Alex: Apex Legends rapid repeat messages",
  "suppressed": true,
  "reason": "Alert suppressed by child settings",
  "childId": "child_alex"
}
```

Frontend flow for each button:

1. Fetch `GET /api/demo/children`.
2. Fetch `GET /api/demo/presets?childId=<selected child id>`.
3. Set game status when the user changes games with `PATCH /api/game-status/:childId` or `PATCH /api/demo/session/game-status/:childId`.
4. On the Worker-served `/demo` page, call `POST /api/demo/session/events/:presetId` using the session cookie and JSON `{ "childId": "<selected child id>" }`.
5. For same-origin Lovable demos, browser code calls `/api/demo/events/:presetId`; the frontend server proxy injects `Authorization: Bearer <DEMO_TRIGGER_KEY>`.
6. Reset alerts when needed with `POST /api/demo/session/alerts/:childId/reset` from `/demo`, or `POST /api/alerts/:childId/reset` through a trusted proxy with `DEMO_API_KEY`.
7. Refresh both `GET /api/dashboard/:childId` and `GET /api/alerts/:childId`.
8. For terminal demos, run `receive-demo-triggers.bat` to poll `GET /api/demo/terminal-events` and print the same game and alert changes.

If `DEMO_PAGE_PASSWORD` is missing, `/demo` returns a fail-closed configuration page and does not expose controls.

## CORS

`ALLOWED_ORIGIN` is read from `wrangler.jsonc`. The Worker only emits `Access-Control-Allow-Origin` when the request origin matches the allowlist. Native Android requests do not need CORS, but Lovable/browser requests do.

For multiple browser origins, set `ALLOWED_ORIGIN` to a comma-separated list.
The default starter config allows `https://lovable.dev`, `https://*.lovable.app`, and local dev `http://localhost:3000`.

## D1 Data Model

The migrations create:

- `children`: demo child profiles.
- `alert_settings`: per-child alert toggles.
- `child_game_status`: current selected game for each demo child.
- `daily_api_calls`: daily UTC API request counts for the 5,000-call cap.
- `risk_events`: sanitized risk-event metadata, parent guidance, parent visibility, and optional worker `event_id` for idempotency. Migration `0004_worker_signal_sync.sql` adds `event_id`, `is_parent_visible`, and a unique `(child_id, event_id)` index for duplicate-safe worker signals.

All SQL requests with user-controlled values use D1 prepared statements with bound parameters.

The seed data includes `child_alex`, `child_maya`, `child_jordan`, default settings for all three, current game status rows, and one high-risk Roblox mock event for Alex.

## Local Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Run type verification:

```bash
npm run typecheck
```

Start local Worker:

```bash
npm run dev
```

Watch demo button presses in a second terminal:

```bat
receive-demo-triggers.bat http://127.0.0.1:8787 2
```

For local mutation testing, create `.dev.vars`:

```dotenv
DEMO_API_KEY=local-demo-key
DEMO_TRIGGER_KEY=local-demo-trigger-key
DEMO_PAGE_PASSWORD=local-demo-page-password
```

Apply D1 migrations locally when using Wrangler dev state:

```bash
npx wrangler d1 migrations apply bumper-db --local
```

Before deployment, create the remote D1 database and replace the placeholder `database_id` in `wrangler.jsonc`, then set the secret:

```bash
npx wrangler d1 create bumper-db
npx wrangler secret put DEMO_API_KEY
npx wrangler secret put DEMO_TRIGGER_KEY
npx wrangler secret put DEMO_PAGE_PASSWORD
npx wrangler d1 migrations apply bumper-db --remote
npm run deploy
```

Or on Windows, run the deployment helper from the project root:

```bat
deploy-bumper.bat
```

To validate without changing remote Cloudflare resources:

```bat
deploy-bumper.bat --check
```
