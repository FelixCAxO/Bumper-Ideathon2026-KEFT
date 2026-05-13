export type RiskLevel = "Low" | "Medium" | "High";

export type IncomingEvent = {
  childId: string;
  platform: string;
  eventType: string;
  contactHandle?: string;
  contactHandleHash?: string;
  messageCount?: number;
  windowMinutes?: number;
  signals?: string[];
  description?: string;
};

export type ScoredEvent = {
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
  parentAction: string;
};

export type DemoGame = {
  id: string;
  label: string;
  rating: string;
};

export type ChildGameStatus = {
  currentGame: DemoGame;
  availableGames: DemoGame[];
};

export type SettingsApi = {
  newFriends: boolean;
  unknownMessages: boolean;
  personalInfo: boolean;
  moveToOtherApp: boolean;
};

export const DEFAULT_SETTINGS: SettingsApi = {
  newFriends: true,
  unknownMessages: true,
  personalInfo: true,
  moveToOtherApp: true
};
