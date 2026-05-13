# Bumper

Bumper keeps the parent-facing interface calm by only showing signal cards when
a Cloudflare Worker posts a signal. The parent alert log starts empty.

## Routes

The app exposes a single parent-facing dashboard page at `/dashboard`.
The root route redirects to the dashboard, and unknown paths also return parents
to the dashboard instead of showing secondary pages.

The dashboard renders its own full-width sidebar layout with child summaries,
each child's currently playing game, alert counts, Account Connections,
screen-time trends, recent alerts, conversation starters, the provided Bumper
logo at the top left, and a responsive bowling-themed dashboard banner.
Dashboard buttons update an in-page flow status region derived from the same
backend-backed child rows, alert feed, game state, and screen-time values that
render the cards.
Former landing, feed, settings, transparency, child, and alert-detail pages have
been removed from the visible app surface.

## Architecture

- **Brand artwork** is checked in at `src/assets/dashboard-logo.png` and
  `src/assets/dashboard-banner.png` and rendered through React brand components
  so hosted previews bundle them with the app.
- **TanStack Start v1** with file-based routing in `src/routes/`; the visible
  route set is limited to the dashboard plus redirect-only root handling.
- **Shared visual system** in `src/styles.css` (warm family-safety tokens:
  gradients, warm palette, trust/safety risk colors).
- **Dashboard brand artwork** is rendered from `src/assets/dashboard-logo.png`
  and `src/assets/dashboard-banner.png` through
  `src/components/guardian/brand-assets.tsx`, so the top-left logo and banner
  stay tied to the checked-in artwork.
- **Static display data** in `src/lib/mock-data.ts` for `child_alex`, `child_maya`, and `child_jordan`, plus no static signals.
- **Screen-time activity data** in `src/lib/mock-data.ts` seeds dated daily minutes for
  May 6 through May 13, 2026. `src/lib/activity-data.ts` converts those records
  into the dashboard chart window, so Activity Overview and summary screen-time
  cards are driven by child data rather than generated chart-only values.
- **Child card risk derivation** in `src/lib/child-risk.ts`; active visible alerts drive
  dashboard risk rings with Low/Medium/High scores of 15/55/90.
- **Parent feed mapping** in `src/lib/signal-feed.ts`; it remains available for
  data transformations and never adds static fallback alerts.
- **Alert summaries** in `src/lib/alert-summary.ts`; weekly counts use ISO `createdAt`
  timestamps from active visible alerts in the trailing 7 days.
- **Alert data contract** in `src/lib/alerts.ts` with ISO `createdAt`, optional
  `isParentVisible`, optional `contact`, and optional worker `eventId`.
- **Visibility-aware alert store** in `src/lib/demo-store.ts`:
  - `getDemoAlerts(childId)` returns active parent-visible alerts only.
  - `getDemoAlerts(childId, { includeHidden: true })` returns active visible and hidden alerts.
  - worker event ingestion is idempotent by child-scoped `eventId`.
  - child-scoped dashboard reads expose `child`, `gameStatus`, `counts`, and `recentAlerts`.
- **Same-origin API proxy** in `src/server.ts`:
  - browser code calls `/api/*` by default.
  - `BACKEND_API_BASE_URL` selects the backend Worker target.
  - Cloudflare runtime bindings are used first; local Vite dev can fall back to
    Node `process.env` for the same server-only keys.
  - public reads are forwarded without browser authorization.
  - `POST /api/demo/events/:presetId` and `POST /api/worker/signals` receive server-side `DEMO_TRIGGER_KEY`.
  - admin mutations such as `POST /api/alerts/:childId/reset`, `PATCH /api/game-status/:childId`, and `PATCH /api/settings/:childId` receive server-side `DEMO_API_KEY`.
- **Family signal polling + backend read APIs** in `src/lib/demo-client.ts` and
  `src/hooks/use-demo-alerts.ts`; the dashboard tracks all child ids, refreshes
  dashboard state once per child on a 60-second cadence, pauses hidden-tab
  polling, and reserves the full `/api/alerts/:childId` feed for explicit
  full-history reads.
- **Dashboard flow actions** in `src/lib/dashboard-flow.ts`; every dashboard
  button routes to shared action state so clicks reflect current alerts, games,
  child risk, and activity context.

## Lovable/TanStack Handoff Constraints

- Keep `.lovable/project.json` at the repository root with template `tanstack_start_ts_2026-05-06`.
- Keep `vite.config.ts` delegated to `@lovable.dev/vite-tanstack-config`.
- Do not add manual duplicate React, TanStack Router, Tailwind, Cloudflare, env injection, or alias plugins.
- Preserve `tanstackStart.server.entry` so Lovable and the Cloudflare build use the same server wrapper.

## Privacy model

The dashboard intentionally separates what is surfaced to parents from full chat
content.

- Parent receives:
  - pattern summary
  - risk level
  - recommendation text
  - timestamps/platform context
- Parent does not receive:
  - private message logs
  - files/photos
  - normal low-risk known interactions

## Tests

Run with `npx --yes vitest run`. Updated coverage includes:

- `tests/alerts.test.ts`
- `tests/alert-summary.test.ts`
- `tests/brand-copy.test.ts`
- `tests/child-risk.test.ts`
- `tests/dashboard-copy.test.ts`
- `tests/dashboard-flow.test.ts`
- `tests/dashboard-brand-assets.test.ts`
- `tests/demo-store.test.ts`
- `tests/design-system.test.ts`
- `tests/frontend-technical-sheet.test.ts`
- `tests/signal-feed.test.ts`
- `tests/lovable-handoff.test.ts`
- `tests/mock-data.test.ts`
- `tests/risk-ring.test.ts`
- `tests/server-not-found-redirect.test.ts`
- `tests/use-demo-alerts.test.ts`
- `tests/worker-signal-api.test.ts`

## Demo backend endpoints

- `POST /api/demo/events/:presetId`
  - creates a simulated alert from a preset
  - browser calls the same-origin path without authorization
  - the frontend server proxy injects `Authorization: Bearer <DEMO_TRIGGER_KEY>`
  - optional body: `{ childId?, isParentVisible? }`
- `POST /api/worker/signals`
  - accepts a signal payload from a Cloudflare Worker
  - receives `Authorization: Bearer <DEMO_TRIGGER_KEY>` from the frontend server proxy
  - requires either body `eventId` or an `Idempotency-Key` header
  - body: `{ childId?, eventId, label?, description?, platform, eventType?, riskLevel, riskScore?, reason, parentAction, signals, date?, createdAt?, contactHandleHash?, isParentVisible? }`
  - duplicate `eventId` deliveries return the existing alert instead of creating a second log entry
- `GET /api/demo/children`
- `GET /api/demo/presets?childId=:childId`
- `GET /api/alerts/:childId`
- `GET /api/dashboard/:childId`
- `GET /api/alert/:alertId`
- `PATCH /api/game-status/:childId`

Parent-facing routes render an empty state until `POST /api/worker/signals` or
`POST /api/demo/events/:presetId` creates a visible alert.
Hidden worker events can still be stored for backend inspection with
`isParentVisible: false`, but they do not appear in parent-facing APIs.

## Worker configuration

- `DEMO_TRIGGER_KEY` is the shared server-side bearer token for
  `POST /api/worker/signals` and demo preset triggers.
- `DEMO_API_KEY` is the shared server-side bearer token for admin mutations.
- `BACKEND_API_BASE_URL` points the frontend proxy at the backend Worker.
- `VITE_API_BASE_URL` is optional; by default the browser client uses same-origin `/api/*`.

Do not expose `DEMO_TRIGGER_KEY` or `DEMO_API_KEY` through client-side `VITE_*`
variables in production. Cloudflare Workers that send signals should attach the
trigger key only in server-side requests.
For local Vite dev, set those server-only values in the Node process environment
or an untracked local env file so the same proxy can run without Cloudflare
runtime bindings.
