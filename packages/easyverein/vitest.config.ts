import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
        },
      },
      {
        // Needs a running local Supabase (pnpm db:start) and .env.local
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
