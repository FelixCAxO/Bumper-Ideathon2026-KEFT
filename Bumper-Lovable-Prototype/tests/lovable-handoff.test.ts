import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Lovable handoff metadata", () => {
  it("keeps the Lovable TanStack template metadata at the repository root", () => {
    const projectFile = resolve(process.cwd(), ".lovable/project.json");
    const project = JSON.parse(readFileSync(projectFile, "utf8")) as {
      schemaVersion?: number;
      template?: string;
    };

    expect(project.schemaVersion).toBe(1);
    expect(project.template).toBe("tanstack_start_ts_2026-05-06");
  });

  it("keeps Vite configuration delegated to Lovable's TanStack template", () => {
    const viteConfig = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");

    expect(viteConfig).toContain("@lovable.dev/vite-tanstack-config");
    expect(viteConfig).toContain("server: {");
    expect(viteConfig).toContain('entry: "server"');
    expect(viteConfig).not.toMatch(/\breact\s*\(/);
    expect(viteConfig).not.toContain("@tanstack/router-vite-plugin");
  });
});
