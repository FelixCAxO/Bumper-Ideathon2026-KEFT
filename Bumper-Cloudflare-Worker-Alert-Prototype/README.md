# Bumper Worker

Cloudflare Worker prototype for the Bumper demo backend.

It serves demo children, dashboard data, alert feeds, settings, a password-gated `/demo` page, and metadata-only alert ingestion.

## Run

```bash
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply bumper-db --local
npm run dev
```

Local demo page:

```text
http://127.0.0.1:8787/demo
```

## Local Secrets

Use throwaway local values in `.dev.vars`:

```dotenv
DEMO_API_KEY=local-demo-key
DEMO_TRIGGER_KEY=local-demo-trigger-key
DEMO_PAGE_PASSWORD=local-demo-page-password
```

## Useful Commands

```bash
npm test
npm run typecheck
npm run deploy
```

## Notes

The Worker accepts sanitized event metadata only. It should not receive full private conversations, passwords, cookies, tokens, screenshots, platform credentials, or unrelated message history.

MIT licensed from the repo root.
