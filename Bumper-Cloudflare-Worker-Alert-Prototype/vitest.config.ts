import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: {
        configPath: "./wrangler.jsonc"
      },
      miniflare: {
        bindings: {
          DEMO_API_KEY: "local-demo-key",
          DEMO_TRIGGER_KEY: "local-demo-trigger-key",
          DEMO_PAGE_PASSWORD: "local-demo-password",
          TEST_MIGRATIONS: await readD1Migrations(path.join(rootDir, "migrations"))
        }
      }
    }))
  ],
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/apply-migrations.ts"]
  }
});
