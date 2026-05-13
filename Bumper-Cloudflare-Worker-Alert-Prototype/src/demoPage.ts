import { DEMO_CHILD_ID_FALLBACK } from "./demoPresets";

type DemoPageEnv = {
  DEMO_PAGE_PASSWORD?: string;
};

const DEMO_SESSION_COOKIE = "bumper_demo_session";
const DEMO_SESSION_MAX_AGE_SECONDS = 60 * 60 * 6;

export function html(body: string, status = 200, headers: HeadersInit = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export function redirect(location: string, status = 302, headers: HeadersInit = {}): Response {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      ...headers
    }
  });
}

function configuredDemoPassword(env: DemoPageEnv): string | undefined {
  const password = env.DEMO_PAGE_PASSWORD?.trim();
  return password || undefined;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlEncodeText(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );

  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([sha256Bytes(left), sha256Bytes(right)]);
  return crypto.subtle.timingSafeEqual(leftHash, rightHash);
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function readCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("Cookie");
  if (!cookie) {
    return undefined;
  }

  for (const item of cookie.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");
    if (rawName === name) {
      return rawValue.join("=");
    }
  }

  return undefined;
}

async function buildDemoSessionCookie(env: DemoPageEnv): Promise<string> {
  const password = configuredDemoPassword(env);
  if (!password) {
    return "";
  }

  const expiresAt = Math.floor(Date.now() / 1000) + DEMO_SESSION_MAX_AGE_SECONDS;
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);
  const payload = `${expiresAt}.${base64UrlEncode(nonce)}`;
  const signature = await hmacSha256Hex(password, payload);
  return `${base64UrlEncodeText(payload)}.${signature}`;
}

export async function hasValidDemoSession(
  request: Request,
  env: DemoPageEnv
): Promise<boolean> {
  const password = configuredDemoPassword(env);
  const cookie = readCookie(request, DEMO_SESSION_COOKIE);
  if (!password || !cookie) {
    return false;
  }

  const [encodedPayload, signature] = cookie.split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  let payload: string;
  try {
    payload = new TextDecoder().decode(base64UrlDecode(encodedPayload));
  } catch {
    return false;
  }

  const [expiresAtText] = payload.split(".");
  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expectedSignature = await hmacSha256Hex(password, payload);
  return timingSafeEqual(signature, expectedSignature);
}

function demoSessionSetCookie(value: string): string {
  return `${DEMO_SESSION_COOKIE}=${value}; Max-Age=${DEMO_SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function demoSessionClearCookie(): string {
  return `${DEMO_SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function renderDemoLoginPage(message = "", status = 200): Response {
  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bumper demo</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f7f7f2; color: #1d2520; }
    main { max-width: 420px; margin: 12vh auto; padding: 28px; background: #ffffff; border: 1px solid #d8ded5; border-radius: 8px; }
    label, input, button { display: block; width: 100%; box-sizing: border-box; }
    input { margin: 8px 0 16px; padding: 12px; border: 1px solid #aeb8ad; border-radius: 6px; }
    button { padding: 12px; border: 0; border-radius: 6px; background: #254f3b; color: white; font-weight: 700; cursor: pointer; }
    .error { color: #9a2d22; min-height: 1.5em; }
  </style>
</head>
<body>
  <main data-testid="demo-login">
    <h1>Bumper demo</h1>
    <p>Enter the demo password to open the alert controls.</p>
    <form method="post" action="/demo/login">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Open demo</button>
    </form>
    <p class="error">${message}</p>
  </main>
</body>
</html>`, status);
}

function renderDemoNotConfiguredPage(): Response {
  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bumper demo unavailable</title>
</head>
<body>
  <main data-testid="demo-not-configured">
    <h1>Demo page is not configured</h1>
    <p>Set DEMO_PAGE_PASSWORD as a Cloudflare Worker secret before using /demo.</p>
  </main>
</body>
</html>`, 503);
}

function renderDemoControlPage(): Response {
  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bumper demo controls</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f3f5f1; color: #152019; }
    header, main { max-width: 1040px; margin: 0 auto; padding: 20px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    button { border: 1px solid #9fb0a5; border-radius: 8px; background: #ffffff; color: #152019; padding: 10px 12px; cursor: pointer; text-align: left; }
    button:hover { border-color: #254f3b; }
    button:disabled { opacity: .55; cursor: wait; }
    .active { background: #254f3b; color: white; border-color: #254f3b; }
    .primary { background: #254f3b; color: white; border-color: #254f3b; text-align: center; }
    .grid { display: grid; grid-template-columns: minmax(260px, .9fr) minmax(340px, 1.1fr); gap: 18px; align-items: start; }
    .panel { background: #ffffff; border: 1px solid #d7ddd6; border-radius: 8px; padding: 16px; }
    .stack { display: grid; gap: 12px; }
    .selector, .presets { display: grid; gap: 8px; }
    .selector { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
    .presets span, .selector span { display: block; margin-top: 4px; color: #536158; font-size: 13px; }
    .active span { color: #dce7df; }
    .counts { display: flex; gap: 10px; flex-wrap: wrap; }
    .count { padding: 8px 10px; border-radius: 6px; background: #eef1ed; }
    li { margin-bottom: 10px; }
    @media (max-width: 760px) { .grid, header { display: block; } header form { margin-top: 12px; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Bumper demo controls</h1>
    </div>
    <form method="post" action="/demo/logout"><button type="submit">Log out</button></form>
  </header>
  <main data-testid="demo-app" data-child-id="${DEMO_CHILD_ID_FALLBACK}">
    <div class="grid">
      <section class="panel stack">
        <div>
          <h2>Kids</h2>
          <div data-testid="child-list" class="selector"></div>
        </div>
        <div>
          <h2>Games</h2>
          <div data-testid="game-list" class="selector"></div>
        </div>
        <div>
          <h2>Trigger scenarios</h2>
          <div data-testid="preset-list" class="presets"></div>
        </div>
      </section>
      <section class="panel">
        <button type="button" class="primary" data-testid="dashboard-refresh">Refresh dashboard</button>
        <button type="button" data-testid="alerts-reset">Reset alerts</button>
        <p data-testid="status-message">Loading dashboard...</p>
        <div data-testid="dashboard-summary"></div>
        <ul data-testid="alerts-list"></ul>
      </section>
    </div>
  </main>
  <script>
    const defaultChildId = "${DEMO_CHILD_ID_FALLBACK}";
    let selectedChildId = defaultChildId;
    let demoChildren = [];
    let selectedGameStatus = null;
    const appEl = document.querySelector('[data-testid="demo-app"]');
    const childListEl = document.querySelector('[data-testid="child-list"]');
    const gameListEl = document.querySelector('[data-testid="game-list"]');
    const presetListEl = document.querySelector('[data-testid="preset-list"]');
    const statusEl = document.querySelector('[data-testid="status-message"]');
    const dashboardEl = document.querySelector('[data-testid="dashboard-summary"]');
    const alertsEl = document.querySelector('[data-testid="alerts-list"]');
    const refreshButton = document.querySelector('[data-testid="dashboard-refresh"]');
    const resetButton = document.querySelector('[data-testid="alerts-reset"]');

    function setStatus(message) {
      statusEl.textContent = message;
    }

    async function readJson(response) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      return data;
    }

    function clearChildren(element) {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }

    function appendText(parent, tagName, text, className) {
      const element = document.createElement(tagName);
      if (className) {
        element.className = className;
      }
      element.textContent = text;
      parent.appendChild(element);
      return element;
    }

    function buttonWithText(label, detail, className) {
      const button = document.createElement("button");
      button.type = "button";
      if (className) {
        button.className = className;
      }
      appendText(button, "strong", label);
      if (detail) {
        appendText(button, "span", detail);
      }
      return button;
    }

    function selectedChild() {
      return childById(selectedChildId);
    }

    function childById(childId) {
      return demoChildren.find((child) => child.id === childId);
    }

    function isCurrentChild(childId) {
      return childId === selectedChildId;
    }

    function renderChildren() {
      clearChildren(childListEl);
      for (const child of demoChildren) {
        const active = child.id === selectedChildId;
        const detail = child.gameStatus.currentGame.label + " - " + child.gameStatus.currentGame.rating;
        const button = buttonWithText(child.displayName, detail, active ? "active" : "");
        button.dataset.childId = child.id;
        button.addEventListener("click", () => selectChild(child.id));
        childListEl.appendChild(button);
      }
      appEl.dataset.childId = selectedChildId;
    }

    function renderGames(gameStatus) {
      selectedGameStatus = gameStatus;
      clearChildren(gameListEl);
      for (const game of gameStatus.availableGames) {
        const active = game.id === gameStatus.currentGame.id;
        const button = buttonWithText(game.label, game.rating, active ? "active" : "");
        button.dataset.gameId = game.id;
        button.addEventListener("click", () => updateGameStatus(game.id, button));
        gameListEl.appendChild(button);
      }
    }

    function renderPresets(presets) {
      clearChildren(presetListEl);
      for (const preset of presets) {
        const detail = preset.platform + " - " + preset.expectedRiskLevel;
        const button = buttonWithText(preset.label, detail, "");
        button.dataset.presetId = preset.id;
        button.addEventListener("click", () => triggerPreset(preset.id, button));
        presetListEl.appendChild(button);
      }
    }

    function syncChildGame(childId, gameStatus) {
      const child = childById(childId);
      if (child) {
        child.gameStatus = gameStatus;
      }
      renderChildren();
      if (isCurrentChild(childId)) {
        renderGames(gameStatus);
      }
    }

    async function loadChildren() {
      const data = await fetch("/api/demo/children").then(readJson);
      demoChildren = data.children;
      if (!demoChildren.some((child) => child.id === selectedChildId)) {
        selectedChildId = demoChildren[0]?.id || defaultChildId;
      }
      const child = selectedChild();
      if (child) {
        selectedGameStatus = child.gameStatus;
      }
      renderChildren();
      if (selectedGameStatus) {
        renderGames(selectedGameStatus);
      }
    }

    async function loadPresets() {
      const childId = selectedChildId;
      const data = await fetch("/api/demo/presets?childId=" + encodeURIComponent(selectedChildId)).then(readJson);
      if (!isCurrentChild(childId)) {
        return;
      }
      renderPresets(data.presets);
    }

    async function refreshDashboard() {
      const childId = selectedChildId;
      setStatus("Refreshing dashboard...");
      const [dashboard, alerts] = await Promise.all([
        fetch("/api/dashboard/" + encodeURIComponent(selectedChildId)).then(readJson),
        fetch("/api/alerts/" + encodeURIComponent(selectedChildId)).then(readJson)
      ]);
      if (!isCurrentChild(childId)) {
        return;
      }

      clearChildren(dashboardEl);
      appendText(dashboardEl, "h2", dashboard.child.displayName);
      const riskLine = document.createElement("p");
      riskLine.append("Overall risk: ");
      appendText(riskLine, "strong", dashboard.riskLevel);
      dashboardEl.appendChild(riskLine);

      const counts = document.createElement("div");
      counts.className = "counts";
      appendText(counts, "span", "Low " + dashboard.counts.Low, "count");
      appendText(counts, "span", "Medium " + dashboard.counts.Medium, "count");
      appendText(counts, "span", "High " + dashboard.counts.High, "count");
      dashboardEl.appendChild(counts);

      clearChildren(alertsEl);
      for (const alert of alerts.alerts) {
        const item = document.createElement("li");
        appendText(item, "strong", alert.riskLevel);
        item.append(" - " + alert.description);
        item.appendChild(document.createElement("br"));
        appendText(item, "small", alert.reason);
        alertsEl.appendChild(item);
      }
      syncChildGame(childId, dashboard.gameStatus);
      setStatus("Dashboard loaded");
    }

    async function selectChild(childId) {
      if (childId === selectedChildId) {
        return;
      }
      selectedChildId = childId;
      const child = selectedChild();
      if (child) {
        selectedGameStatus = child.gameStatus;
      }
      renderChildren();
      if (selectedGameStatus) {
        renderGames(selectedGameStatus);
      }
      await Promise.all([loadPresets(), refreshDashboard()]);
    }

    async function updateGameStatus(gameId, button) {
      const childId = selectedChildId;
      button.disabled = true;
      setStatus("Updating game status...");
      try {
        const result = await fetch("/api/demo/session/game-status/" + encodeURIComponent(selectedChildId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId })
        }).then(readJson);
        if (!isCurrentChild(childId)) {
          return;
        }
        syncChildGame(childId, result.gameStatus);
        setStatus("Game status updated");
      } catch (error) {
        setStatus(error.message);
      } finally {
        button.disabled = false;
      }
    }

    async function triggerPreset(presetId, button) {
      const childId = selectedChildId;
      button.disabled = true;
      setStatus("Triggering " + presetId + "...");
      try {
        const result = await fetch("/api/demo/session/events/" + presetId, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId: selectedChildId })
        }).then(readJson);
        if (!isCurrentChild(childId)) {
          return;
        }
        setStatus(result.suppressed ? "Suppressed by settings: " + result.label : "Created " + result.label);
        await refreshDashboard();
      } catch (error) {
        setStatus(error.message);
      } finally {
        button.disabled = false;
      }
    }

    async function resetAlerts() {
      const childId = selectedChildId;
      resetButton.disabled = true;
      setStatus("Resetting alerts...");
      try {
        await fetch("/api/demo/session/alerts/" + encodeURIComponent(selectedChildId) + "/reset", {
          method: "POST"
        }).then(readJson);
        if (!isCurrentChild(childId)) {
          return;
        }
        setStatus("Alerts reset");
        await refreshDashboard();
      } catch (error) {
        setStatus(error.message);
      } finally {
        resetButton.disabled = false;
      }
    }

    refreshButton.addEventListener("click", () => refreshDashboard().catch((error) => setStatus(error.message)));
    resetButton.addEventListener("click", () => resetAlerts());
    loadChildren()
      .then(() => Promise.all([loadPresets(), refreshDashboard()]))
      .catch((error) => setStatus(error.message));
  </script>
</body>
</html>`);
}

export async function getDemoPage(request: Request, env: DemoPageEnv): Promise<Response> {
  if (!configuredDemoPassword(env)) {
    return renderDemoNotConfiguredPage();
  }

  if (await hasValidDemoSession(request, env)) {
    return renderDemoControlPage();
  }

  return renderDemoLoginPage();
}

export async function loginDemo(request: Request, env: DemoPageEnv): Promise<Response> {
  const password = configuredDemoPassword(env);
  if (!password) {
    return renderDemoNotConfiguredPage();
  }

  const formData = await request.formData();
  const providedValue = formData.get("password");
  const provided = typeof providedValue === "string" ? providedValue : "";

  if (!provided || !(await timingSafeEqual(provided, password))) {
    return renderDemoLoginPage("Invalid password", 401);
  }

  return redirect("/demo", 303, {
    "Set-Cookie": demoSessionSetCookie(await buildDemoSessionCookie(env))
  });
}

export function logoutDemo(): Response {
  return redirect("/demo", 303, {
    "Set-Cookie": demoSessionClearCookie()
  });
}
