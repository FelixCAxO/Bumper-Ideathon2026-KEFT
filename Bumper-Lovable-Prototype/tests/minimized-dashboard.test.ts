import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("dashboard-only app surface", () => {
  it("keeps dashboard as the only visible page route", () => {
    const routeFiles = readdirSync("src/routes")
      .filter((entry) => entry.endsWith(".tsx"))
      .sort();

    expect(routeFiles).toEqual(["__root.tsx", "_app.dashboard.tsx", "_app.tsx", "index.tsx"]);
  });

  it("redirects the root and not-found paths to the dashboard", () => {
    const indexRoute = read("src/routes/index.tsx");
    const rootRoute = read("src/routes/__root.tsx");

    expect(indexRoute).toContain('redirect({ to: "/dashboard" })');
    expect(rootRoute).toContain('to="/dashboard"');
    expect(rootRoute).not.toContain("404");
    expect(rootRoute).not.toContain("Page not found");
  });

  it("does not keep dashboard links to removed routes", () => {
    const dashboard = read("src/routes/_app.dashboard.tsx");

    expect(dashboard).not.toContain('to="/feed"');
    expect(dashboard).not.toContain("href={`/feed/");
    expect(dashboard).not.toContain("Link } from");
    expect(dashboard).not.toContain(", Link");
  });

  it("keeps route tree types scoped to the dashboard app", () => {
    const routeTree = read("src/routeTree.gen.ts");

    for (const removedPath of ["/feed", "/settings", "/transparency", "/child"]) {
      expect(routeTree).not.toContain(removedPath);
    }

    expect(routeTree).toContain("AppDashboardRoute");
    expect(routeTree).toContain("IndexRoute");
  });

  it("keeps docs synced with the single-page dashboard surface", () => {
    const docs = [read("docs/README.md"), read("docs/frontend-technical-sheet.md")].join("\n");
    const staleRouteMentions = ["/feed", "/settings", "/transparency", "/child"].filter((path) =>
      docs.includes(`\`${path}\``),
    );

    expect(staleRouteMentions).toEqual([]);
    expect(docs).toContain(
      "The app exposes a single parent-facing dashboard page at `/dashboard`.",
    );
  });
});
