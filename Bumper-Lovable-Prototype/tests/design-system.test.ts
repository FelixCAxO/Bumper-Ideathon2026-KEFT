import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const extractOklch = (css: string, token: string) => {
  const match = css.match(new RegExp(`${token}:\\s*oklch\\(([^)]+)\\)`));
  if (!match) throw new Error(`Missing ${token}`);
  const [l, c, h] = match[1].trim().split(/\s+/).map(Number);
  return { l, c, h };
};

const oklchToLinearSrgb = ({ l, c, h }: { l: number; c: number; h: number }) => {
  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr) * c;
  const b = Math.sin(hr) * c;
  const lmsPrime = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ];
  const lms = lmsPrime.map((value) => value ** 3);
  return [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ].map((channel) => Math.min(1, Math.max(0, channel)));
};

const relativeLuminance = (rgb: number[]) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

const contrastRatio = (a: number, b: number) => {
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
};

describe("design system", () => {
  it("keeps primary buttons and active navigation at accessible contrast", () => {
    const css = read("src/styles.css");
    const primary = relativeLuminance(oklchToLinearSrgb(extractOklch(css, "--primary")));
    const foreground = relativeLuminance(
      oklchToLinearSrgb(extractOklch(css, "--primary-foreground")),
    );
    expect(contrastRatio(primary, foreground)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps parent-facing routes free of demo/backend labels", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");
    expect(dashboard).not.toMatch(/Simulate|backend|polling|VITE_DEMO_TRIGGER_KEY/);
  });

  it("uses parent-first language in the dashboard-only surface", () => {
    const source = [
      read("src/routes/_app.tsx"),
      read("src/routes/_app.dashboard.tsx"),
      read("src/routes/index.tsx"),
      read("src/routes/__root.tsx"),
    ].join("\n");
    expect(source).not.toMatch(
      /Risk Feed|Risk Event Feed|Risk Level|High-Frequency Unknown|spam|aggressive keywords|Exit to Parent View|Risk alerts/,
    );
  });

  it("matches the Bumper brand and dashboard-only route structure", () => {
    const app = read("src/routes/_app.tsx");
    const index = read("src/routes/index.tsx");
    const dashboard = read("src/routes/_app.dashboard.tsx");
    const root = read("src/routes/__root.tsx");
    const routeTree = read("src/routeTree.gen.ts");
    const docs = read("docs/README.md");
    const userVisibleSource = [app, index, dashboard, root, docs].join("\n");

    expect(index).toContain('redirect({ to: "/dashboard" })');
    expect(root).toContain('to="/dashboard"');
    expect(dashboard).toContain("Good morning");
    expect(userVisibleSource).not.toMatch(/Bumber/);
    expect(routeTree).toContain("AppDashboardRoute");
    expect(routeTree).not.toMatch(/\/feed|\/settings|\/transparency|\/child/);
  });

  it("loads parent-facing signals from all tracked children on the dashboard", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");

    expect(dashboard).toContain("useDemoAlerts(trackedChildIds)");
    expect(dashboard).toContain("getDemoChildren()");
    expect(dashboard).toContain("Recent Alerts");
    expect(dashboard).toContain("Activity Overview");
    expect(dashboard).not.toContain("updateDemoGameStatus");
    expect(dashboard).not.toContain("triggerPreset");
    expect(dashboard).not.toContain('to="/feed"');
    expect(dashboard).not.toContain("href={`/feed/");
  });

  it("points browser APIs at same-origin /api while keeping demo controls configurable", () => {
    const demoClient = read("src/lib/demo-client.ts");
    expect(demoClient).toContain('DEFAULT_API_BASE = ""');
    expect(demoClient).not.toContain("workers.dev");
    expect(demoClient).toContain("DEMO_CONTROL_PANEL_URL");
  });

  it("keeps preview signal controls usable without client-side demo secrets", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");
    const demoClient = read("src/lib/demo-client.ts");

    expect(dashboard).not.toContain("disabled={!isDemoMode}");
    expect(demoClient).toContain("/api/demo/events/");
    expect(demoClient).not.toContain("VITE_DEMO_TRIGGER_KEY");
    expect(demoClient).not.toContain("DEMO_TRIGGER_KEY");
    expect(demoClient).not.toContain('throw new Error("DEMO_TRIGGER_KEY is required');
  });
});
