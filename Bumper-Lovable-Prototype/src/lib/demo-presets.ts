import type { Alert, AlertSignal, RiskLevel } from "@/lib/alerts";
import { getChildById, type GameId } from "@/lib/mock-data";

export type DemoPresetSignal = AlertSignal;

export type DemoPreset = {
  id: string;
  eventType: string;
  gameId: GameId;
  platform: string;
  signals: DemoPresetSignal[];
  riskLevel: RiskLevel;
  riskScore: number;
  isParentVisible?: boolean;
};

export type DemoPresetForChild = DemoPreset & {
  presetId: string;
  label: string;
  description: string;
  reason: string;
  parentAction: string;
  contactHandleHash: string;
  messageCount?: number;
  windowMinutes?: number;
};

export type DemoPresetMap = Record<string, DemoPreset>;

type ChildVariant = {
  giftCount: number;
  giftWindowMinutes: number;
  rapidMessageCount: number;
  rapidWindowMinutes: number;
};

const DEFAULT_CHILD_ID = "child_alex";

const CHILD_VARIANTS: Record<string, ChildVariant> = {
  child_alex: {
    giftCount: 3,
    giftWindowMinutes: 20,
    rapidMessageCount: 18,
    rapidWindowMinutes: 10,
  },
  child_maya: {
    giftCount: 4,
    giftWindowMinutes: 18,
    rapidMessageCount: 16,
    rapidWindowMinutes: 8,
  },
  child_jordan: {
    giftCount: 5,
    giftWindowMinutes: 15,
    rapidMessageCount: 20,
    rapidWindowMinutes: 9,
  },
};

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "roblox_discord_move",
    eventType: "move_to_discord",
    gameId: "roblox",
    platform: "Roblox",
    signals: ["new_contact", "move_to_other_app"],
    riskLevel: "High",
    riskScore: 88,
  },
  {
    id: "personal_info_request",
    eventType: "personal_info_request",
    gameId: "roblox",
    platform: "Roblox",
    signals: ["new_contact", "personal_info"],
    riskLevel: "High",
    riskScore: 92,
  },
  {
    id: "unknown_party_invite",
    eventType: "unknown_party_invite",
    gameId: "fortnite",
    platform: "Fortnite",
    signals: ["new_contact", "unknown_party_invite"],
    riskLevel: "Medium",
    riskScore: 64,
  },
  {
    id: "private_call_invite",
    eventType: "private_call_invite",
    gameId: "roblox",
    platform: "Roblox",
    signals: ["new_contact", "private_call_invite"],
    riskLevel: "High",
    riskScore: 91,
  },
  {
    id: "rapid_messages",
    eventType: "rapid_messages",
    gameId: "apex_legends",
    platform: "Apex Legends",
    signals: ["high_frequency"],
    riskLevel: "High",
    riskScore: 86,
  },
  {
    id: "gift_scam",
    eventType: "gift_scam",
    gameId: "roblox",
    platform: "Roblox",
    signals: ["new_contact", "gift_scam"],
    riskLevel: "High",
    riskScore: 89,
  },
];

export const DEMO_PRESET_BY_ID: DemoPresetMap = DEMO_PRESETS.reduce((acc, preset) => {
  acc[preset.id] = preset;
  return acc;
}, {} as DemoPresetMap);

export const getDemoPreset = (presetId: string): DemoPreset | undefined =>
  DEMO_PRESET_BY_ID[presetId];

const formatDemoDate = (date: Date): string => {
  const labelDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const labelTime = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${labelDate}, ${labelTime}`;
};

const resolveChildId = (childId: string): string =>
  getChildById(childId)?.id ?? getChildById(DEFAULT_CHILD_ID)?.id ?? DEFAULT_CHILD_ID;

const displayChildName = (childId: string): string => {
  const child = getChildById(childId);
  if (child) return child.displayName;
  const normalized = childId.replace(/^child_/, "").trim();
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : "your child";
};

const variantFor = (childId: string): ChildVariant =>
  CHILD_VARIANTS[resolveChildId(childId)] ?? CHILD_VARIANTS[DEFAULT_CHILD_ID];

const contactHashFor = (childId: string, presetId: string): string =>
  `contact_${resolveChildId(childId).replace(/^child_/, "")}_${presetId}`;

const presetCopy = (
  preset: DemoPreset,
  childId: string,
): Omit<DemoPresetForChild, keyof DemoPreset | "presetId" | "label" | "contactHandleHash"> & {
  label: string;
  contactHandleHash: string;
} => {
  const childName = displayChildName(childId);
  const variant = variantFor(childId);

  switch (preset.id) {
    case "roblox_discord_move":
      return {
        label: `${childName}: Roblox to Discord move request`,
        description: `${childName} was asked by a new Roblox contact to continue the conversation on Discord.`,
        reason:
          "A new contact tried to move the conversation to another app before trust was established.",
        parentAction: `Ask ${childName} who the contact is before allowing an off-platform chat.`,
        contactHandleHash: contactHashFor(childId, preset.id),
      };
    case "personal_info_request":
      return {
        label: `${childName}: personal info request`,
        description: `${childName} was asked for personal details during a game chat.`,
        reason: "The message requested private identity or location details from a child account.",
        parentAction: `Remind ${childName} not to share private details and review account privacy settings.`,
        contactHandleHash: contactHashFor(childId, preset.id),
      };
    case "unknown_party_invite":
      return {
        label: `${childName}: unknown party invite`,
        description: `${childName} received a party invite from a player with no trusted context.`,
        reason: "The invite came from a new contact outside the known play group.",
        parentAction: `Check whether ${childName} recognizes the player before accepting the invite.`,
        contactHandleHash: contactHashFor(childId, preset.id),
      };
    case "private_call_invite":
      return {
        label: `${childName}: private voice call invite`,
        description: `A new contact asked ${childName} to join a private voice call.`,
        reason: "Private calls reduce visibility and increase risk when the contact is unknown.",
        parentAction: `Confirm the contact's identity with ${childName} before allowing a private call.`,
        contactHandleHash: contactHashFor(childId, preset.id),
        messageCount: 1,
        windowMinutes: 2,
      };
    case "rapid_messages":
      return {
        label: `${childName}: rapid message burst`,
        description: `${childName} received ${variant.rapidMessageCount} messages in ${variant.rapidWindowMinutes} minutes from a new contact.`,
        reason: "The message volume rose quickly before the contact was trusted.",
        parentAction: `Pause the chat with ${childName} and talk through who is messaging so quickly.`,
        contactHandleHash: contactHashFor(childId, preset.id),
        messageCount: variant.rapidMessageCount,
        windowMinutes: variant.rapidWindowMinutes,
      };
    case "gift_scam":
      return {
        label: `${childName}: gift scam pattern`,
        description: `${childName} was offered ${variant.giftCount} gifts in ${variant.giftWindowMinutes} minutes by a new contact.`,
        reason: "Repeated gift offers can be used to pressure a child into trusting a stranger.",
        parentAction: `Review the gift offer with ${childName} before they accept anything from the contact.`,
        contactHandleHash: contactHashFor(childId, preset.id),
        messageCount: variant.giftCount,
        windowMinutes: variant.giftWindowMinutes,
      };
    default:
      return {
        label: `${childName}: simulated safety signal`,
        description: `${childName} received a safety signal in ${preset.platform}.`,
        reason: `${preset.signals.join(", ")} pattern observed.`,
        parentAction: "Review the context before taking action.",
        contactHandleHash: contactHashFor(childId, preset.id),
      };
  }
};

export const materializeDemoPresetForChild = (
  preset: DemoPreset,
  childId: string,
): DemoPresetForChild => {
  const copy = presetCopy(preset, childId);
  return {
    ...preset,
    presetId: preset.id,
    ...copy,
  };
};

export const getDemoPresetsForChild = (childId: string): DemoPresetForChild[] =>
  DEMO_PRESETS.map((preset) => materializeDemoPresetForChild(preset, childId));

export function createDemoAlertFromPreset(
  preset: DemoPreset,
  childId: string,
  id: number,
  createdAt = new Date(),
  isParentVisible = true,
): Alert {
  const resolvedChildId = resolveChildId(childId);
  const childName = displayChildName(resolvedChildId);
  const scopedPreset = materializeDemoPresetForChild(preset, resolvedChildId);

  return {
    id,
    childId: resolvedChildId,
    child: childName,
    platform: scopedPreset.platform,
    event: scopedPreset.description,
    eventType: scopedPreset.eventType,
    presetId: scopedPreset.id,
    label: scopedPreset.label,
    description: scopedPreset.description,
    riskScore: scopedPreset.riskScore,
    riskLevel: scopedPreset.riskLevel,
    reason: scopedPreset.reason,
    parentAction: scopedPreset.parentAction,
    signals: scopedPreset.signals,
    date: formatDemoDate(createdAt),
    createdAt: createdAt.toISOString(),
    isHandled: false,
    isParentVisible: preset.isParentVisible ?? isParentVisible,
    contactHandleHash: scopedPreset.contactHandleHash,
    messageCount: scopedPreset.messageCount,
    windowMinutes: scopedPreset.windowMinutes,
  };
}
