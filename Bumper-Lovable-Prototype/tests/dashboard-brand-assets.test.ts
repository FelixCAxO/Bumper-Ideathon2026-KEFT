import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("dashboard brand assets", () => {
  it("keeps the checked-in PNG references documented as bundled artwork", () => {
    const readme = read("docs/README.md");
    const techSheet = read("docs/frontend-technical-sheet.md");

    expect(existsSync("src/assets/dashboard-logo.png")).toBe(true);
    expect(existsSync("src/assets/dashboard-banner.png")).toBe(true);
    expect(readme).toContain("src/assets/dashboard-logo.png");
    expect(readme).toContain("src/assets/dashboard-banner.png");
    expect(techSheet).toContain("src/assets/dashboard-logo.png");
    expect(techSheet).toContain("src/assets/dashboard-banner.png");
  });

  it("provides checked-in PNG logo and responsive banner components for the dashboard", () => {
    const brandAssets = read("src/components/guardian/brand-assets.tsx");

    expect(brandAssets).toContain("export function BumperLogo");
    expect(brandAssets).toContain("export function BumperDashboardBanner");
    expect(brandAssets).toContain("@/assets/dashboard-logo.png");
    expect(brandAssets).toContain("@/assets/dashboard-banner.png");
    expect(brandAssets).toContain('alt="Bumper"');
    expect(brandAssets).toContain("object-contain");
    expect(brandAssets).toContain("Let them play");
    expect(brandAssets).toContain("in their lanes.");
    expect(brandAssets).toContain("Bumper helps you stay informed");
  });

  it("uses the provided logo at the top-left and replaces the old banner art", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");

    expect(dashboard).toContain('from "@/components/guardian/brand-assets"');
    expect(dashboard).toContain("<BumperLogo");
    expect(dashboard).toContain('aria-label="Bumper dashboard home"');
    expect(dashboard).toContain("<BumperDashboardBanner");
    expect(dashboard).not.toContain("<BowlingArt");
    expect(dashboard).not.toContain("function BowlingArt");
  });
});
