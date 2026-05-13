export const clampRiskScore = (score: number): number => Math.min(100, Math.max(0, score));
