import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: process.env.CI ? 45000 : 30000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        // cross-env, not a bare `VAR=value` prefix: that syntax is POSIX-only,
        // so on Windows the shell treats the first assignment as the command
        // name and the server never starts ("'NEXT_PUBLIC_COGNITO_USER_POOL_ID'
        // is not recognized as an internal or external command").
        command: "npx cross-env NEXT_PUBLIC_COGNITO_USER_POOL_ID=test NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk_test CI=true pnpm dev -p 3000",
        url: "http://localhost:3000/admin/login",
        reuseExistingServer: true,
        timeout: 90000,
      },
});
