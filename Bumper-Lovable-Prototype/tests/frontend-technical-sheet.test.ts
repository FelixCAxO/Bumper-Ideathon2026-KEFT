import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("frontend technical sheet API contract", () => {
  it("documents same-origin browser API calls and external demo controls", () => {
    const docs = read("docs/frontend-technical-sheet.md");

    expect(docs).toContain("Browser API calls are same-origin");
    expect(docs).toContain("`/api/*`");
    expect(docs).toContain("`VITE_API_BASE_URL`");
    expect(docs).toContain("leave `VITE_API_BASE_URL` empty");
    expect(docs).toContain("`BACKEND_API_BASE_URL`");
    expect(docs).toContain("Vite dev SSR can read");
    expect(docs).toContain("these server-only values from Node `process.env`");
    expect(docs).toContain("`VITE_DEMO_CONTROL_PANEL_URL`");
    expect(docs).toContain("https://bumper-api.example.workers.dev/demo");
  });

  it("documents proxy-side secret injection instead of browser-exposed demo keys", () => {
    const docs = read("docs/frontend-technical-sheet.md");

    expect(docs).toContain("The browser never sends `DEMO_TRIGGER_KEY` or `DEMO_API_KEY`.");
    expect(docs).toContain("The frontend server proxy injects `DEMO_TRIGGER_KEY`");
    expect(docs).toContain("The frontend server proxy injects `DEMO_API_KEY`");
  });

  it("documents the refreshed alert feed contract with string or numeric IDs", () => {
    const docs = read("docs/frontend-technical-sheet.md");

    expect(docs).toContain("`GET /api/dashboard/:childId` should be the default refresh request");
    expect(docs).toContain("`id: string | number`");
    expect(docs).toContain("`/api/alerts/:childId` returns `{ childId, alerts, generatedAt }`");
    expect(docs).toContain("one child-scoped request per child per");
  });

  it("documents the Account Connections dashboard card", () => {
    const docs = read("docs/frontend-technical-sheet.md");

    expect(docs).toContain("Account Connections");
    expect(docs).toContain("connected apps and games");
    expect(docs).toContain("account alerts need attention");
  });
});
