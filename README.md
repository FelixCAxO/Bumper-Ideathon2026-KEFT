# Bumper

Bumper is a hackathon prototype for parents. It shows example alerts when a child may have run into something risky while playing online, without showing their private messages.

![Bumper dashboard screenshot](Bumper-Lovable-Prototype/src/assets/Bumper_Dashboard_Screenshot.png)

## Hackathon

Built during [Drivhuset Ideathon 2026](https://kistasciencecity.com/events/drivhuset-ideathon-2026/), held 12-13 May 2026 at DSV, Stockholm University in Kista.

There were 18 teams. The top 5 pitched in the final round. We were not selected for the final pitch and finished unplaced.

## Team - Team name: KEFT

- [FelixCAxO](https://github.com/FelixCAxO)
- [emillixiao-web](https://github.com/emillixiao-web)
- Tobias H ([Greberra](https://github.com/Greberra))
- [kajgrambo](https://github.com/kajgrambo)

## What We Built

- `Bumper-Lovable-Prototype` - the parent dashboard built with Lovable, TanStack Start, React, and Cloudflare proxy code.
- `Bumper-Cloudflare-Worker-Alert-Prototype` - the Cloudflare Worker backend, D1 schema, demo alert API, and browser demo controls.

The demo uses sample alerts with a risk level, platform, event type, reason, suggested next step, and timestamp. It is meant to show the flow, not collect or display private chats, passwords, screenshots, credentials, or message history.

## Run Locally

Backend:

```bash
cd Bumper-Cloudflare-Worker-Alert-Prototype
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Frontend:

```bash
cd Bumper-Lovable-Prototype
bun install
cp .env.example .env.local
bun run dev
```

For local integration, point the frontend at the local Worker:

```dotenv
BACKEND_API_BASE_URL=http://127.0.0.1:8787
VITE_DEMO_CONTROL_PANEL_URL=http://127.0.0.1:8787/demo
```

## License

MIT. See [LICENSE](LICENSE).
