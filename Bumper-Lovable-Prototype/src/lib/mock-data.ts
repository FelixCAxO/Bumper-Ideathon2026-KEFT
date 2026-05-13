export type Risk = "low" | "medium" | "high";
export type Platform =
  | "Roblox"
  | "Fortnite"
  | "Apex Legends"
  | "Valorant"
  | "Overwatch 2"
  | "Discord"
  | "Steam";

export type GameId = "roblox" | "fortnite" | "apex_legends" | "valorant" | "overwatch_2";

export type GameOption = {
  id: GameId;
  label: Platform;
  rating: string;
};

export type GameStatus = {
  currentGame: GameOption;
  availableGames: GameOption[];
};

export type ScreenTimeEntry = {
  date: string;
  minutes: number;
};

export type Child = {
  id: string;
  displayName: string;
  name: string;
  age: number;
  ageBand: "teen";
  risk: Risk;
  riskScore: number;
  lastActive: string;
  platform: Platform;
  gameStatus: GameStatus;
  screenTimeHistory: ScreenTimeEntry[];
};

export type Signal = {
  id: string;
  childName: string;
  platform: Platform;
  risk: Risk;
  pattern: string;
  description: string;
  recommendation: string;
  contact?: string;
  timestamp: string;
  type:
    | "platform-hop"
    | "new-contact"
    | "personal-info"
    | "high-frequency"
    | "link-shared"
    | "late-night"
    | "safe";
};

export const availableGames: GameOption[] = [
  { id: "roblox", label: "Roblox", rating: "ESRB E10+" },
  { id: "fortnite", label: "Fortnite", rating: "ESRB T" },
  { id: "apex_legends", label: "Apex Legends", rating: "ESRB T" },
  { id: "valorant", label: "Valorant", rating: "ESRB T" },
  { id: "overwatch_2", label: "Overwatch 2", rating: "ESRB T" },
];

const gameById = Object.fromEntries(availableGames.map((game) => [game.id, game])) as Record<
  GameId,
  GameOption
>;

const gameStatusFor = (gameId: GameId): GameStatus => ({
  currentGame: gameById[gameId],
  availableGames,
});

export const children: Child[] = [
  {
    id: "child_alex",
    displayName: "Alex",
    name: "Alex",
    age: 13,
    ageBand: "teen",
    risk: "low",
    riskScore: 12,
    lastActive: "No signals yet",
    platform: "Roblox",
    gameStatus: gameStatusFor("roblox"),
    screenTimeHistory: [
      { date: "2026-05-06", minutes: 96 },
      { date: "2026-05-07", minutes: 128 },
      { date: "2026-05-08", minutes: 122 },
      { date: "2026-05-09", minutes: 85 },
      { date: "2026-05-10", minutes: 78 },
      { date: "2026-05-11", minutes: 126 },
      { date: "2026-05-12", minutes: 138 },
      { date: "2026-05-13", minutes: 144 },
    ],
  },
  {
    id: "child_maya",
    displayName: "Maya",
    name: "Maya",
    age: 14,
    ageBand: "teen",
    risk: "low",
    riskScore: 8,
    lastActive: "No signals yet",
    platform: "Fortnite",
    gameStatus: gameStatusFor("fortnite"),
    screenTimeHistory: [
      { date: "2026-05-06", minutes: 66 },
      { date: "2026-05-07", minutes: 58 },
      { date: "2026-05-08", minutes: 44 },
      { date: "2026-05-09", minutes: 92 },
      { date: "2026-05-10", minutes: 84 },
      { date: "2026-05-11", minutes: 76 },
      { date: "2026-05-12", minutes: 98 },
      { date: "2026-05-13", minutes: 90 },
    ],
  },
  {
    id: "child_jordan",
    displayName: "Jordan",
    name: "Jordan",
    age: 15,
    ageBand: "teen",
    risk: "low",
    riskScore: 10,
    lastActive: "No signals yet",
    platform: "Apex Legends",
    gameStatus: gameStatusFor("apex_legends"),
    screenTimeHistory: [
      { date: "2026-05-06", minutes: 84 },
      { date: "2026-05-07", minutes: 70 },
      { date: "2026-05-08", minutes: 48 },
      { date: "2026-05-09", minutes: 102 },
      { date: "2026-05-10", minutes: 114 },
      { date: "2026-05-11", minutes: 96 },
      { date: "2026-05-12", minutes: 108 },
      { date: "2026-05-13", minutes: 78 },
    ],
  },
];

export const childIds = children.map((child) => child.id);

export const getChildById = (childId: string): Child | undefined =>
  children.find((child) => child.id === childId);

export const getGameById = (gameId: string): GameOption | undefined =>
  availableGames.find((game) => game.id === gameId);

export const signals: Signal[] = [];

export const getSignal = (id: string): Signal | undefined => signals.find((s) => s.id === id);
