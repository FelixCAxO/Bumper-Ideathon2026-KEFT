import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const scanRoots = ["src", "docs"];

const collectFiles = (path: string): string[] => {
  const stat = statSync(path);
  if (stat.isFile()) return [path];

  return readdirSync(path).flatMap((entry) => collectFiles(join(path, entry)));
};

describe("brand copy", () => {
  it("uses Bumper instead of the retired Bumber spelling in source and docs", () => {
    const offenders = scanRoots
      .flatMap(collectFiles)
      .filter((path) => /\.(tsx?|md)$/.test(path))
      .flatMap((path) => {
        const content = readFileSync(path, "utf8");
        return content.includes("Bumber") ? [path] : [];
      });

    expect(offenders).toEqual([]);
  });
});
