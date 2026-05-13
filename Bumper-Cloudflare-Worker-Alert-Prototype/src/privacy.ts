import { badRequest } from "./errors";
import type { IncomingEvent } from "./types";

const ALLOWED_EVENT_FIELDS = new Set([
  "childId",
  "platform",
  "eventType",
  "contactHandle",
  "contactHandleHash",
  "messageCount",
  "windowMinutes",
  "signals",
  "description"
]);

const PRIVATE_CONTENT_FIELDS = new Set([
  "messageText",
  "messageBody",
  "messages",
  "conversation",
  "conversationText",
  "rawMessages",
  "password",
  "passwords",
  "token",
  "tokens",
  "cookie",
  "cookies",
  "credential",
  "credentials"
]);

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const TOKEN_PATTERN = /^[a-zA-Z0-9_:-]{1,80}$/;
const CONTACT_HASH_PATTERN = /^(anon-[a-zA-Z0-9_-]{1,120}|sha256:[a-f0-9]{64})$/;
const PRIVATE_TEXT_PATTERNS = [
  /\b(message|conversation)\s*(text|body|transcript)?\s*[:=]/i,
  /\bfull private (message|conversation)\b/i,
  /\b(password|passcode|token|cookie|credential|secret)\s*[:=]/i,
  /\bmy password is\b/i,
  /\bbearer\s+[a-z0-9._-]+/i
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    badRequest(`${key} is required`);
  }

  return value.trim();
}

function readOptionalString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
): string | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "" || value.length > maxLength) {
    badRequest(`${key} must be a non-empty string no longer than ${maxLength} characters`);
  }

  return value.trim();
}

function rejectPrivateText(value: string): void {
  if (PRIVATE_TEXT_PATTERNS.some((pattern) => pattern.test(value))) {
    badRequest("Bumper accepts risk-event metadata only, not private conversations or credentials");
  }
}

function readOptionalContactHandleHash(body: Record<string, unknown>): string | undefined {
  const value = readOptionalString(body, "contactHandleHash", 160);
  if (value === undefined) {
    return undefined;
  }
  if (!CONTACT_HASH_PATTERN.test(value)) {
    badRequest("contactHandleHash must be an anonymized id or sha256 hash");
  }

  return value;
}

function readOptionalNonNegativeInteger(
  body: Record<string, unknown>,
  key: string,
  maxValue: number
): number | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maxValue) {
    badRequest(`${key} must be an integer between 0 and ${maxValue}`);
  }

  return value;
}

function readSignals(body: Record<string, unknown>): string[] | undefined {
  const value = body.signals;
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > 12) {
    badRequest("signals must be an array with no more than 12 items");
  }

  return value.map((signal) => {
    if (typeof signal !== "string" || !TOKEN_PATTERN.test(signal)) {
      badRequest("signals may only contain short metadata labels");
    }
    return signal;
  });
}

export function parseIncomingEvent(value: unknown): IncomingEvent {
  if (!isRecord(value)) {
    badRequest("JSON body must be an object");
  }

  for (const key of Object.keys(value)) {
    if (PRIVATE_CONTENT_FIELDS.has(key) || !ALLOWED_EVENT_FIELDS.has(key)) {
      badRequest("Bumper accepts risk-event metadata only, not private conversations or credentials");
    }
  }

  const childId = readRequiredString(value, "childId");
  const platform = readRequiredString(value, "platform");
  const eventType = readRequiredString(value, "eventType");

  if (!ID_PATTERN.test(childId)) {
    badRequest("childId format is invalid");
  }
  if (platform.length > 40) {
    badRequest("platform must be no longer than 40 characters");
  }
  if (!TOKEN_PATTERN.test(eventType)) {
    badRequest("eventType may only contain short metadata labels");
  }

  const description = readOptionalString(value, "description", 240);
  if (description !== undefined) {
    rejectPrivateText(description);
  }

  return {
    childId,
    platform,
    eventType,
    contactHandle: readOptionalString(value, "contactHandle", 120),
    contactHandleHash: readOptionalContactHandleHash(value),
    messageCount: readOptionalNonNegativeInteger(value, "messageCount", 1000),
    windowMinutes: readOptionalNonNegativeInteger(value, "windowMinutes", 1440),
    signals: readSignals(value),
    description
  };
}

export async function hashContactHandle(handle: string): Promise<string> {
  const normalized = handle.trim().toLowerCase();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized)
  );

  return `sha256:${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")}`;
}
