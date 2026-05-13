import { badRequest } from "./errors";
import { DEFAULT_SETTINGS, type SettingsApi } from "./types";

const SETTINGS_KEYS = new Set([
  "newFriends",
  "unknownMessages",
  "personalInfo",
  "moveToOtherApp"
]);

export type SettingsRow = {
  new_friends: number;
  unknown_messages: number;
  personal_info: number;
  move_to_other_app: number;
};

export function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

export function dbSettingsToApi(row: SettingsRow): SettingsApi {
  return {
    newFriends: Boolean(row.new_friends),
    unknownMessages: Boolean(row.unknown_messages),
    personalInfo: Boolean(row.personal_info),
    moveToOtherApp: Boolean(row.move_to_other_app)
  };
}

export function parseSettingsPatch(value: unknown, current = DEFAULT_SETTINGS): SettingsApi {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    badRequest("JSON body must be an object");
  }

  const body = value as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!SETTINGS_KEYS.has(key) || typeof body[key] !== "boolean") {
      badRequest("Settings updates may only contain boolean alert toggles");
    }
  }

  return {
    ...current,
    ...(body as Partial<SettingsApi>)
  };
}
