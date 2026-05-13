import type { ChildGameStatus, DemoGame, IncomingEvent, RiskLevel, SettingsApi } from "./types";

export const DEMO_CHILD_ID_FALLBACK = "child_alex";

export const DEMO_CHILD_IDS = [
  "child_alex",
  "child_maya",
  "child_jordan"
] as const;

export type DemoChildId = (typeof DEMO_CHILD_IDS)[number];

export type DemoChildProfile = {
  id: DemoChildId;
  displayName: string;
  ageBand: string;
};

export const DEMO_GAMES = [
  {
    id: "roblox",
    label: "Roblox",
    rating: "All Ages"
  },
  {
    id: "fortnite",
    label: "Fortnite",
    rating: "PG-13"
  },
  {
    id: "apex_legends",
    label: "Apex Legends",
    rating: "PG-13"
  },
  {
    id: "valorant",
    label: "Valorant",
    rating: "PG-13"
  },
  {
    id: "overwatch_2",
    label: "Overwatch 2",
    rating: "PG-13"
  }
] as const satisfies readonly DemoGame[];

export type DemoGameId = (typeof DEMO_GAMES)[number]["id"];

export const DEMO_CHILDREN: Record<DemoChildId, DemoChildProfile> = {
  child_alex: {
    id: "child_alex",
    displayName: "Alex",
    ageBand: "teen"
  },
  child_maya: {
    id: "child_maya",
    displayName: "Maya",
    ageBand: "teen"
  },
  child_jordan: {
    id: "child_jordan",
    displayName: "Jordan",
    ageBand: "teen"
  }
};

export const DEMO_PRESET_IDS = [
  "roblox_discord_move",
  "personal_info_request",
  "unknown_party_invite",
  "private_call_invite",
  "rapid_messages",
  "gift_scam"
] as const;

export type DemoPresetId = (typeof DEMO_PRESET_IDS)[number];

export type DemoPreset = {
  label: string;
  description: string;
  expectedRiskLevel: RiskLevel;
  setting: keyof SettingsApi;
  gameId: DemoGameId;
  event: Omit<IncomingEvent, "childId">;
};

export type DemoPresetSummary = {
  id: DemoPresetId;
  childId: string;
  label: string;
  description: string;
  gameId: DemoGameId;
  platform: string;
  eventType: string;
  expectedRiskLevel: RiskLevel;
  setting: keyof SettingsApi;
};

export const DEMO_PRESETS: Record<DemoPresetId, DemoPreset> = {
  roblox_discord_move: {
    label: "Roblox unknown user asks to move to Discord",
    description: "High-risk game chat alert for an unknown Roblox contact pushing the child to Discord.",
    expectedRiskLevel: "High",
    setting: "unknownMessages",
    gameId: "roblox",
    event: {
      platform: "Roblox",
      eventType: "unknown_messages",
      messageCount: 18,
      windowMinutes: 10,
      signals: ["new_contact", "high_frequency", "move_to_other_app"],
      description: "Unknown user asked to move to Discord."
    }
  },
  personal_info_request: {
    label: "Roblox player asks for personal info",
    description: "Medium-risk alert for age, real name, school, or location questions.",
    expectedRiskLevel: "Medium",
    setting: "personalInfo",
    gameId: "roblox",
    event: {
      platform: "Roblox",
      eventType: "personal_info",
      signals: ["new_contact", "asks_personal_info"],
      description: "Unknown player asks for age and real name."
    }
  },
  unknown_party_invite: {
    label: "Fortnite party invite from unknown player",
    description: "Low-risk baseline alert for a new party or friend invite.",
    expectedRiskLevel: "Low",
    setting: "newFriends",
    gameId: "fortnite",
    event: {
      platform: "Fortnite",
      eventType: "new_friend",
      signals: ["new_contact"],
      description: "Fortnite party invite from an unknown player."
    }
  },
  private_call_invite: {
    label: "Fortnite private call invite",
    description: "High-risk alert for an unknown profile inviting the child into a private voice call.",
    expectedRiskLevel: "High",
    setting: "moveToOtherApp",
    gameId: "fortnite",
    event: {
      platform: "Fortnite",
      eventType: "call_invite",
      signals: ["voice_call", "new_contact"],
      description: "Private call invite from unknown profile."
    }
  },
  rapid_messages: {
    label: "Apex Legends rapid repeat messages",
    description: "Medium-risk alert for repeated messages in a short time window.",
    expectedRiskLevel: "Medium",
    setting: "unknownMessages",
    gameId: "apex_legends",
    event: {
      platform: "Apex Legends",
      eventType: "unknown_messages",
      messageCount: 18,
      windowMinutes: 10,
      signals: ["high_frequency"],
      description: "Unknown player repeatedly messages in a short time."
    }
  },
  gift_scam: {
    label: "Roblox gift or Robux scam lure",
    description: "Medium-risk alert for a game currency, skin, or gift lure.",
    expectedRiskLevel: "Medium",
    setting: "unknownMessages",
    gameId: "roblox",
    event: {
      platform: "Roblox",
      eventType: "gift_scam",
      signals: ["gift_scam"],
      description: "Gift or Robux/skin lure message."
    }
  }
};

const CHILD_EVENT_OVERRIDES: Record<DemoChildId, Partial<Record<DemoPresetId, Partial<IncomingEvent>>>> = {
  child_alex: {
    gift_scam: {
      messageCount: 3,
      windowMinutes: 20
    }
  },
  child_maya: {
    gift_scam: {
      messageCount: 4,
      windowMinutes: 18
    },
    rapid_messages: {
      messageCount: 16,
      windowMinutes: 8
    }
  },
  child_jordan: {
    gift_scam: {
      messageCount: 5,
      windowMinutes: 15
    },
    rapid_messages: {
      messageCount: 20,
      windowMinutes: 9
    }
  }
};

function childProfile(childId: string): DemoChildProfile {
  return DEMO_CHILDREN[isDemoChildId(childId) ? childId : DEMO_CHILD_ID_FALLBACK];
}

function copyGame(game: DemoGame): DemoGame {
  return {
    id: game.id,
    label: game.label,
    rating: game.rating
  };
}

export function isDemoChildId(value: string): value is DemoChildId {
  return (DEMO_CHILD_IDS as readonly string[]).includes(value);
}

export function isDemoGameId(value: string): value is DemoGameId {
  return DEMO_GAMES.some((game) => game.id === value);
}

export function getDemoGame(gameId: string): DemoGame {
  return copyGame(DEMO_GAMES.find((game) => game.id === gameId) ?? DEMO_GAMES[0]);
}

export function buildGameStatus(currentGameId: string): ChildGameStatus {
  return {
    currentGame: getDemoGame(currentGameId),
    availableGames: DEMO_GAMES.map(copyGame)
  };
}

export function getDemoPresetForChild(
  childId: string,
  presetId: DemoPresetId
): DemoPreset {
  const profile = childProfile(childId);
  const preset = DEMO_PRESETS[presetId];
  const overrides = isDemoChildId(profile.id)
    ? CHILD_EVENT_OVERRIDES[profile.id][presetId] ?? {}
    : {};

  return {
    ...preset,
    label: `${profile.displayName}: ${preset.label}`,
    description: `${profile.displayName} demo alert - ${preset.description}`,
    event: {
      ...preset.event,
      ...overrides
    }
  };
}

export function listDemoPresetSummaries(childId = DEMO_CHILD_ID_FALLBACK): DemoPresetSummary[] {
  return DEMO_PRESET_IDS.map((id) => {
    const preset = getDemoPresetForChild(childId, id);
    return {
      id,
      childId,
      label: preset.label,
      description: preset.description,
      gameId: preset.gameId,
      platform: preset.event.platform,
      eventType: preset.event.eventType,
      expectedRiskLevel: preset.expectedRiskLevel,
      setting: preset.setting
    };
  });
}
