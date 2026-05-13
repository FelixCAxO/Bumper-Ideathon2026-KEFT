import type { IncomingEvent, RiskLevel, ScoredEvent, SettingsApi } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const SCORE_SETTINGS_FALLBACK: SettingsApi = DEFAULT_SETTINGS;

export function buildDescription(event: IncomingEvent): string {
  const countPart =
    event.messageCount !== undefined && event.windowMinutes !== undefined
      ? ` (${event.messageCount} messages in ${event.windowMinutes} minutes)`
      : "";

  return `${event.platform}: ${event.eventType.replaceAll("_", " ")}${countPart}`;
}

export function scoreEvent(
  event: IncomingEvent,
  settings: SettingsApi = SCORE_SETTINGS_FALLBACK
): ScoredEvent {
  const signals = new Set(event.signals ?? []);
  const reasons: string[] = [];
  let score = 0;

  const highFrequency =
    (event.messageCount ?? 0) >= 15 && (event.windowMinutes ?? 999) <= 10;

  const hasNewContact =
    event.eventType === "new_friend" || signals.has("new_contact");

  const isPersonalInfoRisk =
    event.eventType === "personal_info" || signals.has("asks_personal_info");

  const isMoveToOtherAppRisk =
    event.eventType === "move_to_other_app" ||
    signals.has("move_to_other_app");

  const isCallInviteRisk =
    event.eventType === "call_invite" ||
    signals.has("voice_call") ||
    signals.has("call_invite") ||
    event.eventType === "voice_call";

  const isGiftScam =
    event.eventType === "gift_scam" ||
    signals.has("gift_scam") ||
    signals.has("robux") ||
    signals.has("skin_scam");

  if (settings.newFriends && hasNewContact) {
    score += 20;
    reasons.push("new contact");
  }

  if (settings.unknownMessages && (
    event.eventType === "unknown_messages" ||
    highFrequency ||
    signals.has("high_frequency")
  )) {
    score += 35;
    reasons.push("high message frequency");
  }

  if (settings.personalInfo && isPersonalInfoRisk) {
    score += 30;
    reasons.push("personal-info request or sharing");
  }

  if (settings.moveToOtherApp && isMoveToOtherAppRisk) {
    score += 35;
    reasons.push("asked to move conversation to another app");
  }

  if (settings.moveToOtherApp && isCallInviteRisk) {
    score += 50;
    reasons.push("private call invitation");
  }

  if (settings.unknownMessages && isGiftScam) {
    score += 45;
    reasons.push("gift/scam lure");
  }

  if (
    settings.moveToOtherApp &&
    /discord|snapchat|telegram|whatsapp/i.test(event.description ?? "")
  ) {
    score += 10;
    reasons.push("another platform was mentioned");
  }

  score = Math.min(score, 100);

  const riskLevel: RiskLevel =
    score >= 70 ? "High" : score >= 35 ? "Medium" : "Low";

  const parentAction =
    riskLevel === "High"
      ? "Talk to the child calmly before blocking or reporting. Ask what happened and whether they know this person."
      : riskLevel === "Medium"
        ? "Review the pattern and consider a check-in conversation."
        : "No urgent action. Keep monitoring for repeated patterns.";

  return {
    riskScore: score,
    riskLevel,
    reason: reasons.length ? reasons.join(" + ") : "No strong risk pattern detected",
    parentAction
  };
}
