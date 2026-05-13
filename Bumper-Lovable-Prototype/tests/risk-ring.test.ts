import { describe, expect, it } from "vitest";
import { clampRiskScore } from "../src/lib/risk-score";

describe("clampRiskScore", () => {
  it("keeps score math within the display range", () => {
    expect(clampRiskScore(-12)).toBe(0);
    expect(clampRiskScore(55)).toBe(55);
    expect(clampRiskScore(140)).toBe(100);
  });
});
