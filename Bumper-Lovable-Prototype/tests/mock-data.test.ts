import { describe, expect, it } from "vitest";
import { MOCK_ALERTS } from "../src/lib/alerts";
import { childIds, children, signals } from "../src/lib/mock-data";

describe("static family preparation data", () => {
  it("starts with exactly three child profiles", () => {
    expect(children.map((child) => child.id)).toEqual(["child_alex", "child_maya", "child_jordan"]);
    expect(children.map((child) => child.displayName)).toEqual(["Alex", "Maya", "Jordan"]);
    expect(children.every((child) => child.ageBand === "teen")).toBe(true);
    expect(childIds).toEqual(["child_alex", "child_maya", "child_jordan"]);
  });

  it("starts with no static recent signals or logs", () => {
    expect(signals).toEqual([]);
    expect(MOCK_ALERTS).toEqual([]);
  });
});
