import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type FrontendProxyEnv = {
  BACKEND_API_BASE_URL?: string;
  DEMO_TRIGGER_KEY?: string;
  DEMO_API_KEY?: string;
};

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type RequiredProxySecret = {
  name: "DEMO_TRIGGER_KEY" | "DEMO_API_KEY";
  value: string | undefined;
};

type FrontendProxyEnvKey = keyof FrontendProxyEnv;

let serverEntryPromise: Promise<ServerEntry> | undefined;
const DASHBOARD_PATH = "/dashboard";
const initialProcessEnv = typeof process === "undefined" ? undefined : { ...process.env };

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function apiError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function proxyEnvValue(
  env: FrontendProxyEnv | undefined,
  key: FrontendProxyEnvKey,
): string | undefined {
  const runtimeValue = env?.[key]?.trim();
  if (runtimeValue) return runtimeValue;

  const processEnv = typeof process === "undefined" ? undefined : process.env;
  const processValue =
    processEnv && Object.prototype.hasOwnProperty.call(processEnv, key)
      ? processEnv[key]?.trim()
      : undefined;
  if (process.env.VITEST && processValue && initialProcessEnv?.[key]?.trim() === processValue) {
    return undefined;
  }
  return processValue || undefined;
}

function backendApiBaseUrl(env: FrontendProxyEnv | undefined): string | undefined {
  const raw = proxyEnvValue(env, "BACKEND_API_BASE_URL");
  return raw ? trimTrailingSlash(raw) : undefined;
}

function backendUrlForRequest(request: Request, backendBaseUrl: string): string {
  const source = new URL(request.url);
  const target = new URL(backendBaseUrl);
  const basePath = target.pathname === "/" ? "" : trimTrailingSlash(target.pathname);
  target.pathname = `${basePath}${source.pathname}`;
  target.search = source.search;
  return target.toString();
}

function isMutationMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function requiredProxySecret(
  pathname: string,
  method: string,
  env: FrontendProxyEnv,
): RequiredProxySecret | undefined {
  if (!isMutationMethod(method)) return undefined;

  if (pathname.startsWith("/api/demo/events/") || pathname === "/api/worker/signals") {
    return { name: "DEMO_TRIGGER_KEY", value: proxyEnvValue(env, "DEMO_TRIGGER_KEY") };
  }

  if (
    /^\/api\/alerts\/.+\/reset$/.test(pathname) ||
    pathname === "/api/events" ||
    pathname.startsWith("/api/game-status/") ||
    pathname.startsWith("/api/settings/")
  ) {
    return { name: "DEMO_API_KEY", value: proxyEnvValue(env, "DEMO_API_KEY") };
  }

  return undefined;
}

function proxiedRequestHeaders(request: Request, secret: RequiredProxySecret | undefined): Headers {
  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }
  headers.delete("authorization");

  if (secret?.value) {
    headers.set("authorization", `Bearer ${secret.value}`);
  }

  return headers;
}

async function requestBodyForProxy(request: Request): Promise<BodyInit | undefined> {
  if (request.method === "GET" || request.method === "HEAD" || request.body == null) {
    return undefined;
  }

  return request.arrayBuffer();
}

function proxyResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isFileLikePath(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() ?? "";
  return /\.[a-z0-9]+$/i.test(lastSegment);
}

function shouldRedirectSsrNotFound(request: Request, response: Response): boolean {
  if (response.status !== 404) return false;
  if (!["GET", "HEAD"].includes(request.method.toUpperCase())) return false;

  const { pathname } = new URL(request.url);
  if (pathname === DASHBOARD_PATH || pathname.startsWith("/api/")) return false;
  if (isFileLikePath(pathname)) return false;

  return true;
}

function redirectToDashboard(): Response {
  return new Response(null, {
    status: 302,
    headers: { location: DASHBOARD_PATH },
  });
}

async function proxyApiRequest(
  request: Request,
  env: FrontendProxyEnv,
): Promise<Response | undefined> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/api/")) return undefined;

  const backendBaseUrl = backendApiBaseUrl(env);
  if (!backendBaseUrl) {
    return apiError("BACKEND_API_BASE_URL is not configured.", 500);
  }

  const secret = requiredProxySecret(pathname, request.method, env);
  if (secret && !secret.value) {
    return apiError(`${secret.name} is not configured.`, 500);
  }

  const proxiedRequest = new Request(backendUrlForRequest(request, backendBaseUrl), {
    method: request.method,
    headers: proxiedRequestHeaders(request, secret),
    body: await requestBodyForProxy(request),
    redirect: "manual",
  });

  try {
    return proxyResponse(await fetch(proxiedRequest));
  } catch (error) {
    console.error(error);
    return apiError("Unable to reach backend API.", 502);
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} - try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const apiResponse = await proxyApiRequest(request, env as FrontendProxyEnv);
    if (apiResponse) {
      return apiResponse;
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      if (shouldRedirectSsrNotFound(request, response)) {
        return redirectToDashboard();
      }
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
