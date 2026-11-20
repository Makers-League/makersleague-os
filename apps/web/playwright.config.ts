import { defineConfig, devices } from "@playwright/test";

// Needs the local Supabase stack (bun run db:start). globalSetup resets it to the seed data.
const port = 3000;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Each test uses its own seed member (see e2e/auth.spec.ts), so they can run in parallel.
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI tests the production build; locally the dev server is faster to start.
    command: ci ? "bun run start" : "bun run dev",
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !ci,
    timeout: 120_000,
  },
});
