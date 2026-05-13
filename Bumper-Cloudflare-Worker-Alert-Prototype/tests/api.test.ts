import { env, exports } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";

const API_KEY = "local-demo-key";
const DEMO_TRIGGER_KEY = "local-demo-trigger-key";
const DEMO_PAGE_PASSWORD = "local-demo-password";
const BASE_URL = "https://bumper.test";
const ALLOWED_ORIGIN = "https://lovable.dev";

type JsonObject = Record<string, unknown>;

async function resetDatabase(): Promise<void> {
  await env.DB.exec(`
    DROP TABLE IF EXISTS risk_events;
    DROP TABLE IF EXISTS alert_settings;
    DROP TABLE IF EXISTS child_game_status;
    DROP TABLE IF EXISTS daily_api_calls;
    DROP TABLE IF EXISTS children;
    DROP TABLE IF EXISTS d1_migrations;
  `);
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(new Request(`${BASE_URL}${path}`, init));
}

async function apiWithEnv(
  path: string,
  envOverrides: Partial<Env>,
  init: RequestInit = {}
): Promise<Response> {
  const runtimeEnv = {
    DB: env.DB,
    ALLOWED_ORIGIN: env.ALLOWED_ORIGIN,
    DEMO_API_KEY: env.DEMO_API_KEY,
    DEMO_TRIGGER_KEY: env.DEMO_TRIGGER_KEY,
    DEMO_PAGE_PASSWORD: env.DEMO_PAGE_PASSWORD,
    ...envOverrides
  } as Env;

  return worker.fetch(new Request(`${BASE_URL}${path}`, init), runtimeEnv);
}

async function jsonBody<T extends JsonObject>(response: Response): Promise<T> {
  expect(response.headers.get("content-type")).toContain("application/json");
  return response.json<T>();
}

async function textBody(response: Response): Promise<string> {
  expect(response.headers.get("content-type")).toContain("text/html");
  return response.text();
}

function authorized(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${API_KEY}`);
  return {
    ...init,
    headers
  };
}

function authorizedDemo(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${DEMO_TRIGGER_KEY}`);
  return {
    ...init,
    headers
  };
}

async function loginToDemo(password = DEMO_PAGE_PASSWORD): Promise<string> {
  const response = await api("/demo/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ password }).toString(),
    redirect: "manual"
  });

  expect(response.status).toBe(303);
  const cookie = response.headers.get("set-cookie");
  expect(cookie).toContain("bumper_demo_session=");
  return cookie?.split(";")[0] ?? "";
}

describe("Bumper Worker API", () => {
  beforeEach(async () => {
    await resetDatabase();
  }, 30000);

  it("returns health and CORS preflight without authorization", async () => {
    const health = await api("/api/health", {
      headers: {
        Origin: ALLOWED_ORIGIN
      }
    });

    expect(health.status).toBe(200);
    expect(health.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    await expect(jsonBody(health)).resolves.toMatchObject({
      ok: true,
      service: "bumper-api"
    });

    const preflight = await api("/api/events", {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "POST"
      }
    });

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");
    expect(preflight.headers.get("access-control-allow-headers")).toContain("Authorization");

    const wildcard = await api("/api/health", {
      headers: {
        Origin: "https://demo.lovable.app"
      }
    });
    expect(wildcard.status).toBe(200);
    expect(wildcard.headers.get("access-control-allow-origin")).toBe("https://demo.lovable.app");
  });

  it("creates the D1 table used for daily API call caps", async () => {
    const table = await env.DB.prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'daily_api_calls'
      `
    ).first<{ name: string }>();

    expect(table?.name).toBe("daily_api_calls");
  });

  it("limits API traffic to 5,000 calls per UTC day without counting preflight", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS daily_api_calls (
        call_date TEXT PRIMARY KEY,
        call_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await env.DB.prepare(
      `
        INSERT INTO daily_api_calls (
          call_date,
          call_count
        ) VALUES (?, ?)
      `
    )
      .bind(today, 4999)
      .run();

    const allowed = await api("/api/health");
    expect(allowed.status).toBe(200);

    const countAfterAllowed = await env.DB.prepare(
      "SELECT call_count AS callCount FROM daily_api_calls WHERE call_date = ?"
    )
      .bind(today)
      .first<{ callCount: number }>();
    expect(countAfterAllowed?.callCount).toBe(5000);

    const preflight = await api("/api/health", {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "GET"
      }
    });
    expect(preflight.status).toBe(204);

    const countAfterPreflight = await env.DB.prepare(
      "SELECT call_count AS callCount FROM daily_api_calls WHERE call_date = ?"
    )
      .bind(today)
      .first<{ callCount: number }>();
    expect(countAfterPreflight?.callCount).toBe(5000);

    const blocked = await api("/api/health");
    expect(blocked.status).toBe(429);
    await expect(jsonBody(blocked)).resolves.toEqual({
      error: "Daily API call limit exceeded"
    });
  });

  it("does not grant CORS access to untrusted browser origins", async () => {
    const response = await api("/api/health", {
      headers: {
        Origin: "https://untrusted.example"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });

  it("redirects the root page to the password-gated demo page", async () => {
    const response = await api("/", {
      redirect: "manual"
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/demo");
  });

  it("serves login HTML for unauthenticated demo visitors without exposing trigger secrets", async () => {
    const response = await api("/demo");

    expect(response.status).toBe(200);
    const html = await textBody(response);
    expect(html).toContain("Bumper demo");
    expect(html).toContain('name="password"');
    expect(html).toContain('action="/demo/login"');
    expect(html).not.toContain(DEMO_TRIGGER_KEY);
    expect(html).not.toContain(DEMO_PAGE_PASSWORD);
    expect(html).not.toContain("local-demo-key");
    expect(html).not.toContain("data-preset-id");
  });

  it("rejects invalid demo passwords and sets a secure session cookie on valid login", async () => {
    const rejected = await api("/demo/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ password: "wrong-password" }).toString()
    });

    expect(rejected.status).toBe(401);
    expect(rejected.headers.has("set-cookie")).toBe(false);
    expect(await textBody(rejected)).toContain("Invalid password");

    const accepted = await api("/demo/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ password: DEMO_PAGE_PASSWORD }).toString(),
      redirect: "manual"
    });

    expect(accepted.status).toBe(303);
    expect(accepted.headers.get("location")).toBe("/demo");
    const cookie = accepted.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("bumper_demo_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("serves the demo control page to authenticated sessions", async () => {
    const sessionCookie = await loginToDemo();
    const response = await api("/demo", {
      headers: {
        Cookie: sessionCookie
      }
    });

    expect(response.status).toBe(200);
    const html = await textBody(response);
    expect(html).toContain("Bumper demo controls");
    expect(html).toContain('data-child-id="child_alex"');
    expect(html).toContain('data-testid="child-list"');
    expect(html).toContain('data-testid="game-list"');
    expect(html).toContain('data-testid="preset-list"');
    expect(html).toContain('data-testid="alerts-reset"');
    expect(html).toContain('fetch("/api/demo/children")');
    expect(html).toContain('fetch("/api/demo/presets?childId=" + encodeURIComponent(selectedChildId))');
    expect(html).toContain('fetch("/api/dashboard/" + encodeURIComponent(selectedChildId))');
    expect(html).toContain('fetch("/api/alerts/" + encodeURIComponent(selectedChildId))');
    expect(html).toContain('fetch("/api/demo/session/game-status/" + encodeURIComponent(selectedChildId)');
    expect(html).toContain('fetch("/api/demo/session/events/"');
    expect(html).toContain('fetch("/api/demo/session/alerts/" + encodeURIComponent(selectedChildId) + "/reset"');
    expect(html).toContain('JSON.stringify({ childId: selectedChildId })');
    expect(html).toContain('JSON.stringify({ gameId })');
    expect(html).toContain("function isCurrentChild(childId)");
    expect(html).toContain("if (!isCurrentChild(childId))");
    expect(html).not.toContain('fetch("/api/dashboard/child_alex"');
    expect(html).not.toContain('fetch("/api/alerts/child_alex"');
    expect(html).toContain("createElement");
    expect(html).not.toContain("innerHTML");
    expect(html).not.toContain(DEMO_TRIGGER_KEY);
    expect(html).not.toContain(DEMO_PAGE_PASSWORD);
    expect(html).not.toContain("Authorization");
  });

  it("logs out demo sessions by clearing the session cookie", async () => {
    const sessionCookie = await loginToDemo();
    const response = await api("/demo/logout", {
      method: "POST",
      headers: {
        Cookie: sessionCookie
      },
      redirect: "manual"
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/demo");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("bumper_demo_session=");
    expect(cookie).toContain("Max-Age=0");
  });

  it("requires a configured page password before serving the demo page", async () => {
    const response = await apiWithEnv("/demo", {
      DEMO_PAGE_PASSWORD: ""
    });

    expect(response.status).toBe(503);
    const html = await textBody(response);
    expect(html).toContain("Demo page is not configured");
  });

  it("serves a public demo preset catalog for frontend buttons", async () => {
    const response = await api("/api/demo/presets");

    expect(response.status).toBe(200);
    const body = await jsonBody<{
      presets: Array<{
        id: string;
        label: string;
        description: string;
        platform: string;
        eventType: string;
        expectedRiskLevel: string;
        setting: string;
      }>;
    }>(response);

    expect(body.presets.map((preset) => preset.id)).toEqual([
      "roblox_discord_move",
      "personal_info_request",
      "unknown_party_invite",
      "private_call_invite",
      "rapid_messages",
      "gift_scam"
    ]);
    expect(body.presets).toContainEqual(
      expect.objectContaining({
        id: "private_call_invite",
        eventType: "call_invite",
        expectedRiskLevel: "High",
        setting: "moveToOtherApp"
      })
    );
    expect(body.presets).toContainEqual(
      expect.objectContaining({
        id: "gift_scam",
        eventType: "gift_scam",
        expectedRiskLevel: "Medium",
        setting: "unknownMessages"
      })
    );
    expect(JSON.stringify(body)).not.toMatch(
      /contactHandle|messageText|messageBody|conversationText|rawMessages/i
    );
  });

  it("serves three demo kids with five selectable game statuses", async () => {
    const response = await api("/api/demo/children");

    expect(response.status).toBe(200);
    const body = await jsonBody<{
      children: Array<{
        id: string;
        displayName: string;
        ageBand: string;
        gameStatus: {
          currentGame: { id: string; label: string; rating: string };
          availableGames: Array<{ id: string; label: string; rating: string }>;
        };
      }>;
    }>(response);

    expect(body.children.map((child) => child.id)).toEqual([
      "child_alex",
      "child_maya",
      "child_jordan"
    ]);

    for (const child of body.children) {
      expect(child.gameStatus.availableGames.map((game) => game.id)).toEqual([
        "roblox",
        "fortnite",
        "apex_legends",
        "valorant",
        "overwatch_2"
      ]);
      expect(child.gameStatus.availableGames.filter((game) => game.id !== "roblox")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rating: "PG-13" })
        ])
      );
      expect(
        child.gameStatus.availableGames.every((game) =>
          game.id === "roblox" || game.rating === "PG-13"
        )
      ).toBe(true);
      expect(child.gameStatus.availableGames.map((game) => game.id)).toContain(
        child.gameStatus.currentGame.id
      );

      const dashboard = await api(`/api/dashboard/${child.id}`);
      expect(dashboard.status).toBe(200);
      const dashboardBody = await jsonBody<{
        gameStatus: {
          currentGame: { id: string };
          availableGames: Array<{ id: string }>;
        };
      }>(dashboard);
      expect(dashboardBody.gameStatus.currentGame.id).toBe(child.gameStatus.currentGame.id);
      expect(dashboardBody.gameStatus.availableGames).toHaveLength(5);
    }
  });

  it("updates child game status through bearer and demo-session endpoints", async () => {
    const bearerUpdated = await api("/api/game-status/child_maya", authorized({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ gameId: "valorant" })
    }));

    expect(bearerUpdated.status).toBe(200);
    await expect(jsonBody(bearerUpdated)).resolves.toMatchObject({
      gameStatus: {
        currentGame: {
          id: "valorant",
          rating: "PG-13"
        }
      }
    });

    const noSession = await api("/api/demo/session/game-status/child_jordan", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ gameId: "overwatch_2" })
    });
    expect(noSession.status).toBe(401);
    await expect(jsonBody(noSession)).resolves.toEqual({
      error: "Demo session required"
    });

    const sessionCookie = await loginToDemo();
    const sessionUpdated = await api("/api/demo/session/game-status/child_jordan", {
      method: "PATCH",
      headers: {
        Cookie: sessionCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ gameId: "overwatch_2" })
    });

    expect(sessionUpdated.status).toBe(200);
    await expect(jsonBody(sessionUpdated)).resolves.toMatchObject({
      gameStatus: {
        currentGame: {
          id: "overwatch_2",
          rating: "PG-13"
        }
      }
    });

    const dashboard = await api("/api/dashboard/child_jordan");
    const dashboardBody = await jsonBody<{
      gameStatus: { currentGame: { id: string } };
    }>(dashboard);
    expect(dashboardBody.gameStatus.currentGame.id).toBe("overwatch_2");

    const rejected = await api("/api/game-status/child_maya", authorized({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ gameId: "minecraft" })
    }));
    expect(rejected.status).toBe(400);
    await expect(jsonBody(rejected)).resolves.toEqual({
      error: "Unknown game"
    });
  });

  it("surfaces demo-site button changes in a terminal-friendly polling feed", async () => {
    const sessionCookie = await loginToDemo();
    const initialFeed = await api("/api/demo/terminal-events");

    expect(initialFeed.status).toBe(200);
    const initialBody = await jsonBody<{
      children: Array<{
        childId: string;
        displayName: string;
        gameStatus: {
          currentGame: { id: string; label: string };
        };
      }>;
      alerts: Array<Record<string, unknown>>;
    }>(initialFeed);
    expect(initialBody.children.map((child) => child.childId)).toEqual([
      "child_alex",
      "child_maya",
      "child_jordan"
    ]);
    expect(initialBody.alerts).toEqual([
      expect.objectContaining({
        childId: "child_alex",
        riskLevel: "High"
      })
    ]);

    const gameButtonPress = await api("/api/demo/session/game-status/child_maya", {
      method: "PATCH",
      headers: {
        Cookie: sessionCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ gameId: "valorant" })
    });
    expect(gameButtonPress.status).toBe(200);

    const triggerButtonPress = await api("/api/demo/session/events/gift_scam", {
      method: "POST",
      headers: {
        Cookie: sessionCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ childId: "child_maya" })
    });
    expect(triggerButtonPress.status).toBe(201);
    const created = await jsonBody<{
      id: string;
      label: string;
      presetId: string;
      riskLevel: string;
    }>(triggerButtonPress);

    const terminalFeed = await api("/api/demo/terminal-events");
    expect(terminalFeed.status).toBe(200);
    const terminalBody = await jsonBody<{
      generatedAt: string;
      children: Array<{
        childId: string;
        displayName: string;
        gameStatus: {
          currentGame: { id: string; label: string; rating: string };
        };
      }>;
      alerts: Array<{
        id: string;
        childId: string;
        label: string;
        presetId?: string;
        riskLevel: string;
        isParentVisible: boolean;
      }>;
    }>(terminalFeed);

    expect(typeof terminalBody.generatedAt).toBe("string");
    expect(
      terminalBody.children.find((child) => child.childId === "child_maya")
    ).toMatchObject({
      displayName: "Maya",
      gameStatus: {
        currentGame: {
          id: "valorant",
          label: "Valorant",
          rating: "PG-13"
        }
      }
    });
    expect(terminalBody.alerts[0]).toMatchObject({
      id: created.id,
      childId: "child_maya",
      label: created.label,
      presetId: "gift_scam",
      riskLevel: created.riskLevel,
      isParentVisible: true
    });
  });

  it("serves six child-specific demo trigger alerts per kid", async () => {
    const childIds = ["child_alex", "child_maya", "child_jordan"];
    const expectedPresetIds = [
      "roblox_discord_move",
      "personal_info_request",
      "unknown_party_invite",
      "private_call_invite",
      "rapid_messages",
      "gift_scam"
    ];
    const labels = new Set<string>();
    const labelsByChild = new Map<string, Map<string, string>>();

    for (const childId of childIds) {
      const response = await api(`/api/demo/presets?childId=${childId}`);
      expect(response.status).toBe(200);
      const body = await jsonBody<{
        presets: Array<{
          id: string;
          childId: string;
          label: string;
          description: string;
          gameId: string;
          platform: string;
          eventType: string;
          expectedRiskLevel: string;
          setting: string;
        }>;
      }>(response);

      expect(body.presets.map((preset) => preset.id)).toEqual(expectedPresetIds);
      expect(body.presets).toHaveLength(6);
      labelsByChild.set(
        childId,
        new Map(body.presets.map((preset) => [preset.id, preset.label]))
      );

      for (const preset of body.presets) {
        expect(preset.childId).toBe(childId);
        expect(preset.label).toBeTruthy();
        expect(preset.description).toBeTruthy();
        expect(preset.gameId).toBeTruthy();
        labels.add(preset.label);
      }
    }

    expect(labels.size).toBe(18);
    expect(labelsByChild.get("child_alex")?.get("gift_scam")).not.toBe(
      labelsByChild.get("child_maya")?.get("gift_scam")
    );
    expect(labelsByChild.get("child_maya")?.get("rapid_messages")).not.toBe(
      labelsByChild.get("child_jordan")?.get("rapid_messages")
    );

    const unknownChild = await api("/api/demo/presets?childId=not_a_child");
    expect(unknownChild.status).toBe(404);
    await expect(jsonBody(unknownChild)).resolves.toEqual({
      error: "Child not found"
    });
  });

  it("uses child-specific demo preset variants when creating alerts", async () => {
    const alexCreated = await api("/api/demo/events/gift_scam", authorizedDemo({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ childId: "child_alex" })
    }));
    const mayaCreated = await api("/api/demo/events/gift_scam", authorizedDemo({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ childId: "child_maya" })
    }));

    expect(alexCreated.status).toBe(201);
    expect(mayaCreated.status).toBe(201);
    const alexBody = await jsonBody<{
      id: string;
      childId: string;
      label: string;
      description: string;
    }>(alexCreated);
    const mayaBody = await jsonBody<{
      id: string;
      childId: string;
      label: string;
      description: string;
    }>(mayaCreated);

    expect(alexBody.childId).toBe("child_alex");
    expect(mayaBody.childId).toBe("child_maya");
    expect(alexBody.label).not.toBe(mayaBody.label);
    expect(alexBody.description).not.toBe(mayaBody.description);

    const mayaAlerts = await api("/api/alerts/child_maya");
    const mayaAlertsBody = await jsonBody<{ alerts: Array<{ id: string }> }>(mayaAlerts);
    expect(mayaAlertsBody.alerts.map((alert) => alert.id)).toContain(mayaBody.id);
  });

  it("serves seeded dashboard, alerts, settings, alert detail, and transparency metadata", async () => {
    const dashboard = await api("/api/dashboard/child_alex");
    expect(dashboard.status).toBe(200);
    const dashboardBody = await jsonBody<{
      child: { id: string; displayName: string; ageBand: string };
      riskLevel: string;
      counts: { Low: number; Medium: number; High: number };
      recentAlerts: Array<JsonObject>;
    }>(dashboard);

    expect(dashboardBody.child).toEqual({
      id: "child_alex",
      displayName: "Alex",
      ageBand: "teen"
    });
    expect(dashboardBody.riskLevel).toBe("High");
    expect(dashboardBody.counts.High).toBe(1);
    expect(dashboardBody.recentAlerts).toHaveLength(1);
    expect(JSON.stringify(dashboardBody)).not.toMatch(/password|messageText|conversation/i);

    const alerts = await api("/api/alerts/child_alex");
    expect(alerts.status).toBe(200);
    const alertsBody = await jsonBody<{ alerts: Array<{ id: string; riskLevel: string }> }>(alerts);
    expect(alertsBody.alerts).toEqual([
      expect.objectContaining({
        id: "alert_demo_1",
        riskLevel: "High"
      })
    ]);

    const detail = await api("/api/alert/alert_demo_1");
    expect(detail.status).toBe(200);
    const detailBody = await jsonBody<{
      id: string;
      childId: string;
      contactHandleHash: string;
      metadata: { signals: string[]; messageCount: number; windowMinutes: number };
    }>(detail);
    expect(detailBody).toMatchObject({
      id: "alert_demo_1",
      childId: "child_alex",
      contactHandleHash: "anon-contact-1"
    });
    expect(detailBody.metadata.signals).toContain("move_to_other_app");
    expect(detailBody.metadata.messageCount).toBe(18);

    const settings = await api("/api/settings/child_alex");
    expect(settings.status).toBe(200);
    await expect(jsonBody(settings)).resolves.toEqual({
      settings: {
        newFriends: true,
        unknownMessages: true,
        personalInfo: true,
        moveToOtherApp: true
      }
    });

    const transparency = await api("/api/transparency/child_alex");
    expect(transparency.status).toBe(200);
    const transparencyBody = await jsonBody<{
      parentsCanSee: string[];
      parentsCannotSee: string[];
    }>(transparency);
    expect(transparencyBody.parentsCanSee).toContain("risk level");
    expect(transparencyBody.parentsCannotSee).toContain("full private conversations");
  });

  it("resets child alerts through bearer and demo-session endpoints", async () => {
    const mayaCreated = await api("/api/demo/events/gift_scam", authorizedDemo({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ childId: "child_maya" })
    }));
    expect(mayaCreated.status).toBe(201);
    const mayaBody = await jsonBody<{ id: string }>(mayaCreated);

    const bearerReset = await api("/api/alerts/child_alex/reset", authorized({
      method: "POST"
    }));
    expect(bearerReset.status).toBe(200);
    await expect(jsonBody(bearerReset)).resolves.toEqual({
      childId: "child_alex",
      reset: true,
      deletedAlerts: 1
    });

    const alexAlerts = await api("/api/alerts/child_alex");
    await expect(jsonBody(alexAlerts)).resolves.toMatchObject({
      childId: "child_alex",
      alerts: []
    });

    const alexDashboard = await api("/api/dashboard/child_alex");
    await expect(jsonBody(alexDashboard)).resolves.toMatchObject({
      riskLevel: "Low",
      counts: {
        Low: 0,
        Medium: 0,
        High: 0
      },
      recentAlerts: []
    });

    const deletedDetail = await api("/api/alert/alert_demo_1");
    expect(deletedDetail.status).toBe(404);

    const mayaAlertsBeforeSessionReset = await api("/api/alerts/child_maya");
    const mayaAlertsBeforeBody = await jsonBody<{ alerts: Array<{ id: string }> }>(
      mayaAlertsBeforeSessionReset
    );
    expect(mayaAlertsBeforeBody.alerts.map((alert) => alert.id)).toContain(mayaBody.id);

    const sessionCookie = await loginToDemo();
    const sessionReset = await api("/api/demo/session/alerts/child_maya/reset", {
      method: "POST",
      headers: {
        Cookie: sessionCookie
      }
    });
    expect(sessionReset.status).toBe(200);
    await expect(jsonBody(sessionReset)).resolves.toEqual({
      childId: "child_maya",
      reset: true,
      deletedAlerts: 1
    });

    const mayaAlertsAfterSessionReset = await api("/api/alerts/child_maya");
    await expect(jsonBody(mayaAlertsAfterSessionReset)).resolves.toMatchObject({
      childId: "child_maya",
      alerts: []
    });
  });

  it("requires the demo bearer token for every mutation", async () => {
    const missingToken = await api("/api/settings/child_alex", {
      method: "PATCH",
      body: JSON.stringify({ unknownMessages: false })
    });
    expect(missingToken.status).toBe(401);

    const missingGameStatusToken = await api("/api/game-status/child_alex", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ gameId: "roblox" })
    });
    expect(missingGameStatusToken.status).toBe(401);

    const missingResetToken = await api("/api/alerts/child_alex/reset", {
      method: "POST"
    });
    expect(missingResetToken.status).toBe(401);

    const wrongToken = await api("/api/events", {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        childId: "child_alex",
        platform: "Roblox",
        eventType: "unknown_messages"
      })
    });
    expect(wrongToken.status).toBe(401);

    const missingDemoToken = await api("/api/demo/events/rapid_messages", {
      method: "POST",
      body: JSON.stringify({ childId: "child_alex" })
    });
    expect(missingDemoToken.status).toBe(401);

    const wrongDemoToken = await api("/api/demo/events/rapid_messages", {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ childId: "child_alex" })
    });
    expect(wrongDemoToken.status).toBe(401);

    const rawEventWithDemoTrigger = await api("/api/events", authorizedDemo({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        childId: "child_alex",
        platform: "Roblox",
        eventType: "unknown_messages"
      })
    }));
    expect(rawEventWithDemoTrigger.status).toBe(401);
  });

  it("uses session cookies, not bearer tokens, for in-page demo triggers", async () => {
    const noSession = await api("/api/demo/session/events/roblox_discord_move", {
      method: "POST"
    });
    expect(noSession.status).toBe(401);
    await expect(jsonBody(noSession)).resolves.toEqual({
      error: "Demo session required"
    });

    const resetWithoutSession = await api("/api/demo/session/alerts/child_alex/reset", {
      method: "POST"
    });
    expect(resetWithoutSession.status).toBe(401);
    await expect(jsonBody(resetWithoutSession)).resolves.toEqual({
      error: "Demo session required"
    });

    const sessionCookie = await loginToDemo();
    const created = await api("/api/demo/session/events/roblox_discord_move", {
      method: "POST",
      headers: {
        Cookie: sessionCookie
      }
    });

    expect(created.status).toBe(201);
    const body = await jsonBody<{
      id: string;
      presetId: string;
      riskLevel: string;
    }>(created);
    expect(body.id).toBeTruthy();
    expect(body.presetId).toBe("roblox_discord_move");
    expect(body.riskLevel).toBe("High");

    const mayaCreated = await api("/api/demo/session/events/gift_scam", {
      method: "POST",
      headers: {
        Cookie: sessionCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ childId: "child_maya" })
    });
    expect(mayaCreated.status).toBe(201);
    await expect(jsonBody(mayaCreated)).resolves.toMatchObject({
      presetId: "gift_scam",
      childId: "child_maya"
    });

    const unknownPreset = await api("/api/demo/session/events/not_a_preset", {
      method: "POST",
      headers: {
        Cookie: sessionCookie
      }
    });
    expect(unknownPreset.status).toBe(404);
    await expect(jsonBody(unknownPreset)).resolves.toEqual({
      error: "Demo preset not found"
    });
  });

  it("persists partial settings updates through D1", async () => {
    const updated = await api("/api/settings/child_alex", authorized({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        unknownMessages: false,
        moveToOtherApp: false
      })
    }));

    expect(updated.status).toBe(200);
    await expect(jsonBody(updated)).resolves.toEqual({
      settings: {
        newFriends: true,
        unknownMessages: false,
        personalInfo: true,
        moveToOtherApp: false
      }
    });

    const settings = await api("/api/settings/child_alex");
    await expect(jsonBody(settings)).resolves.toMatchObject({
      settings: {
        unknownMessages: false,
        moveToOtherApp: false
      }
    });
  });

  it("exposes each demo preset as a dedicated event trigger endpoint", async () => {
    const presetIds = [
      "roblox_discord_move",
      "personal_info_request",
      "unknown_party_invite",
      "private_call_invite",
      "rapid_messages",
      "gift_scam"
    ];
    const expectedRiskByPreset: Record<string, string> = {
      roblox_discord_move: "High",
      personal_info_request: "Medium",
      unknown_party_invite: "Low",
      private_call_invite: "High",
      rapid_messages: "Medium",
      gift_scam: "Medium"
    };

    const initialAlerts = await api("/api/alerts/child_alex");
    const initialBody = await jsonBody<{ alerts: Array<{ id: string }> }>(initialAlerts);

    for (const presetId of presetIds) {
      const created = await api(`/api/demo/events/${presetId}`, authorizedDemo({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ childId: "child_alex" })
      }));
      expect(created.status).toBe(201);

      const createdBody = await jsonBody<{
        id: string;
        presetId: string;
        label: string;
        childId: string;
        description: string;
        riskLevel: string;
        riskScore: number;
        reason: string;
        parentAction: string;
      }>(created);
      expect(createdBody.id).toBeTruthy();
      expect(createdBody.presetId).toBe(presetId);
      expect(createdBody.childId).toBe("child_alex");
      expect(createdBody.label).toBeTruthy();
      expect(createdBody.description).toBeTruthy();
      expect(createdBody.riskLevel).toBe(expectedRiskByPreset[presetId]);
      expect(createdBody.riskScore).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(createdBody)).not.toMatch(
        /contactHandle|messageText|messageBody|conversationText|rawMessages/i
      );
    }

    const finalAlerts = await api("/api/alerts/child_alex");
    const finalBody = await jsonBody<{ alerts: Array<{ id: string }> }>(finalAlerts);
    expect(finalBody.alerts.length).toBe(initialBody.alerts.length + presetIds.length);

    const missingPreset = await api("/api/demo/events/not_a_preset", authorizedDemo({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ childId: "child_alex" })
    }));
    expect(missingPreset.status).toBe(404);
    await expect(jsonBody(missingPreset)).resolves.toEqual({
      error: "Demo preset not found"
    });
  });

  it("supports demo preset fallback child selection and setting-based suppression", async () => {
    const before = await api("/api/alerts/child_alex");
    const beforeBody = await jsonBody<{ alerts: Array<{ id: string; eventType: string }> }>(before);

    const updatedSettings = await api("/api/settings/child_alex", authorized({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        unknownMessages: false
      })
    }));
    expect(updatedSettings.status).toBe(200);

    const suppressed = await api("/api/demo/events/rapid_messages", authorizedDemo({
      method: "POST"
    }));
    expect(suppressed.status).toBe(200);
    await expect(jsonBody(suppressed)).resolves.toMatchObject({
      presetId: "rapid_messages",
      childId: "child_alex",
      suppressed: true,
      reason: "Alert suppressed by child settings"
    });

    const after = await api("/api/alerts/child_alex");
    const afterBody = await jsonBody<{ alerts: Array<{ id: string; eventType: string }> }>(after);
    expect(afterBody.alerts.length).toBe(beforeBody.alerts.length);
  });

  it("keeps enabled signal families when another matching setting is disabled", async () => {
    const updatedSettings = await api("/api/settings/child_alex", authorized({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        unknownMessages: false,
        moveToOtherApp: true
      })
    }));
    expect(updatedSettings.status).toBe(200);

    const created = await api("/api/demo/events/roblox_discord_move", authorizedDemo({
      method: "POST"
    }));

    expect(created.status).toBe(201);
    const createdBody = await jsonBody<{
      presetId: string;
      riskScore: number;
      riskLevel: string;
      reason: string;
    }>(created);
    expect(createdBody.presetId).toBe("roblox_discord_move");
    expect(createdBody.riskScore).toBeGreaterThanOrEqual(35);
    expect(createdBody.reason).toContain("move conversation to another app");
    expect(createdBody.reason).not.toContain("high message frequency");
  });

  it("ingests sanitized mock risk events and never returns raw contact handles", async () => {
    const created = await api("/api/events", authorized({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        childId: "child_alex",
        platform: "Roblox",
        eventType: "unknown_messages",
        contactHandle: "CoolUser#123",
        messageCount: 18,
        windowMinutes: 10,
        signals: ["new_contact", "high_frequency", "move_to_other_app"],
        description: "Unknown user sent many messages and asked to move to Discord"
      })
    }));

    expect(created.status).toBe(201);
    const createdBody = await jsonBody<{ id: string; riskLevel: string; riskScore: number }>(created);
    expect(createdBody.riskLevel).toBe("High");
    expect(createdBody.riskScore).toBeGreaterThanOrEqual(70);
    expect(JSON.stringify(createdBody)).not.toContain("CoolUser#123");

    const detail = await api(`/api/alert/${createdBody.id}`);
    const detailBody = await jsonBody<{
      contactHandleHash: string;
      metadata: { signals: string[]; messageCount: number; windowMinutes: number };
    }>(detail);

    expect(detailBody.contactHandleHash).toMatch(/^sha256:/);
    expect(JSON.stringify(detailBody)).not.toContain("CoolUser#123");
    expect(detailBody.metadata.signals).toContain("new_contact");
    expect(detailBody.metadata.messageCount).toBe(18);
    expect(detailBody.metadata.windowMinutes).toBe(10);
  });

  it("derives event descriptions from metadata instead of persisting user-supplied text", async () => {
    const created = await api("/api/events", authorized({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        childId: "child_alex",
        platform: "Roblox",
        eventType: "unknown_messages",
        messageCount: 3,
        windowMinutes: 5,
        signals: ["new_contact"],
        description: "User-controlled summary should not be stored verbatim"
      })
    }));

    expect(created.status).toBe(201);
    const createdBody = await jsonBody<{ id: string; description: string }>(created);
    expect(createdBody.description).toBe("Roblox: unknown messages (3 messages in 5 minutes)");

    const detail = await api(`/api/alert/${createdBody.id}`);
    const detailBody = await jsonBody<{ description: string }>(detail);
    expect(detailBody.description).toBe("Roblox: unknown messages (3 messages in 5 minutes)");
    expect(JSON.stringify(detailBody)).not.toContain("User-controlled summary");
  });

  it("rejects private content and raw contact hashes instead of storing them", async () => {
    const rejected = await api("/api/events", authorized({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        childId: "child_alex",
        platform: "Discord",
        eventType: "unknown_messages",
        messageText: "this is a full private message"
      })
    }));

    expect(rejected.status).toBe(400);
    await expect(jsonBody(rejected)).resolves.toMatchObject({
      error: expect.stringMatching(/metadata only/i)
    });

    const rejectedDescription = await api("/api/events", authorized({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        childId: "child_alex",
        platform: "Discord",
        eventType: "unknown_messages",
        description: "message text: this is copied from the private conversation"
      })
    }));

    expect(rejectedDescription.status).toBe(400);
    await expect(jsonBody(rejectedDescription)).resolves.toMatchObject({
      error: expect.stringMatching(/metadata only/i)
    });

    const rejectedRawHash = await api("/api/events", authorized({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        childId: "child_alex",
        platform: "Roblox",
        eventType: "new_friend",
        contactHandleHash: "CoolUser#123"
      })
    }));

    expect(rejectedRawHash.status).toBe(400);
    await expect(jsonBody(rejectedRawHash)).resolves.toMatchObject({
      error: expect.stringMatching(/contactHandleHash/i)
    });
  });

  it("returns frontend-safe alert summaries from dashboard and alert feed reads", async () => {
    const sessionCookie = await loginToDemo();
    const created = await api("/api/demo/session/events/gift_scam", {
      method: "POST",
      headers: {
        Cookie: sessionCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ childId: "child_jordan" })
    });
    expect(created.status).toBe(201);
    const createdBody = await jsonBody<{
      id: string;
      childId: string;
      presetId: string;
      label: string;
      riskLevel: string;
    }>(created);

    const dashboardResponse = await api("/api/dashboard/child_jordan");
    expect(dashboardResponse.status).toBe(200);
    const dashboard = await jsonBody<{
      childId: string;
      recentAlerts: Array<Record<string, unknown>>;
    }>(dashboardResponse);
    expect(dashboard.childId).toBe("child_jordan");
    expect(dashboard.recentAlerts[0]).toMatchObject({
      id: createdBody.id,
      childId: "child_jordan",
      presetId: "gift_scam",
      label: createdBody.label,
      platform: "Roblox",
      eventType: "gift_scam",
      riskLevel: createdBody.riskLevel,
      isParentVisible: true
    });
    expect(dashboard.recentAlerts[0].signals).toEqual(expect.arrayContaining(["gift_scam"]));
    expect(typeof dashboard.recentAlerts[0].date).toBe("string");
    expect(typeof dashboard.recentAlerts[0].createdAt).toBe("string");
    expect(typeof dashboard.recentAlerts[0].reason).toBe("string");
    expect(typeof dashboard.recentAlerts[0].parentAction).toBe("string");

    const alertsResponse = await api("/api/alerts/child_jordan");
    expect(alertsResponse.status).toBe(200);
    const feed = await jsonBody<{
      childId: string;
      generatedAt: string;
      alerts: Array<Record<string, unknown>>;
    }>(alertsResponse);
    expect(feed.childId).toBe("child_jordan");
    expect(typeof feed.generatedAt).toBe("string");
    expect(feed.alerts[0]).toMatchObject(dashboard.recentAlerts[0]);
  });

  it("accepts idempotent worker signals through the frontend sync intake", async () => {
    const payload = {
      childId: "child_maya",
      description: "Unknown Roblox account shared an external link",
      platform: "Roblox",
      eventType: "unknown_link",
      riskLevel: "Medium",
      reason: "A new contact sent a link before there was any trusted context.",
      parentAction: "Ask Maya whether she knows this person before opening the link.",
      signals: ["new_contact"],
      contactHandleHash: "anon-worker-signal",
      isParentVisible: true
    };

    const first = await api("/api/worker/signals", authorizedDemo({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "worker-signal-1"
      },
      body: JSON.stringify(payload)
    }));
    expect(first.status).toBe(201);
    const firstBody = await jsonBody<{
      id: string;
      childId: string;
      eventId: string;
      label: string;
      riskScore: number;
    }>(first);
    expect(firstBody).toMatchObject({
      childId: "child_maya",
      eventId: "worker-signal-1",
      label: payload.description,
      riskScore: 60
    });

    const duplicate = await api("/api/worker/signals", authorizedDemo({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "worker-signal-1"
      },
      body: JSON.stringify({
        childId: "child_maya",
        label: "Maya: duplicate should not create another alert"
      })
    }));
    expect(duplicate.status).toBe(200);
    const duplicateBody = await jsonBody<{ id: string; eventId: string }>(duplicate);
    expect(duplicateBody).toMatchObject({
      id: firstBody.id,
      eventId: "worker-signal-1"
    });

    const alertsResponse = await api("/api/alerts/child_maya");
    const alertsBody = await jsonBody<{ alerts: Array<{ id: string; eventId?: string }> }>(
      alertsResponse
    );
    expect(alertsBody.alerts.map((alert) => alert.id)).toEqual([firstBody.id]);
    expect(alertsBody.alerts[0].eventId).toBe("worker-signal-1");
  });

  it("returns stable JSON errors for missing records and unknown routes", async () => {
    const missingChild = await api("/api/dashboard/not_a_child");
    expect(missingChild.status).toBe(404);
    await expect(jsonBody(missingChild)).resolves.toEqual({
      error: "Child not found"
    });

    const missingAlerts = await api("/api/alerts/not_a_child");
    expect(missingAlerts.status).toBe(404);
    await expect(jsonBody(missingAlerts)).resolves.toEqual({
      error: "Child not found"
    });

    const missingSettings = await api("/api/settings/not_a_child");
    expect(missingSettings.status).toBe(404);
    await expect(jsonBody(missingSettings)).resolves.toEqual({
      error: "Child not found"
    });

    const missingTransparency = await api("/api/transparency/not_a_child");
    expect(missingTransparency.status).toBe(404);
    await expect(jsonBody(missingTransparency)).resolves.toEqual({
      error: "Child not found"
    });

    const unknown = await api("/api/nope");
    expect(unknown.status).toBe(404);
    await expect(jsonBody(unknown)).resolves.toEqual({
      error: "Not found"
    });
  });

  it("rejects unknown-child settings mutations and extra path segments", async () => {
    const unknownChildPatch = await api("/api/settings/not_a_child", authorized({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        unknownMessages: false
      })
    }));

    expect(unknownChildPatch.status).toBe(404);
    await expect(jsonBody(unknownChildPatch)).resolves.toEqual({
      error: "Child not found"
    });

    const healthExtra = await api("/api/health/extra");
    expect(healthExtra.status).toBe(404);

    const dashboardExtra = await api("/api/dashboard/child_alex/extra");
    expect(dashboardExtra.status).toBe(404);

    const eventsExtra = await api("/api/events/extra", authorized({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        childId: "child_alex",
        platform: "Roblox",
        eventType: "new_friend"
      })
    }));
    expect(eventsExtra.status).toBe(404);
  });
});
