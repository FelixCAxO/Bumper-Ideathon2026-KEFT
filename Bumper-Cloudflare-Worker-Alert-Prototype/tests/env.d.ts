import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      DEMO_API_KEY: string;
      DEMO_TRIGGER_KEY: string;
      DEMO_PAGE_PASSWORD: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
