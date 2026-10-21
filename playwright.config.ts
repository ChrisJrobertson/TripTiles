import { defineConfig, devices } from "@playwright/test";

const port = 3001;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 300_000,
  expect: { timeout: 120_000 },
  use: {
    baseURL,
    navigationTimeout: 180_000,
    actionTimeout: 120_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "public", testMatch: /public-journey\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "customer",
      testMatch: /existing-customer\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "returning",
      testMatch: /returning-customer\.spec\.ts/,
      timeout: 300_000,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "journey",
      testMatch: /first-customer-journey\.spec\.ts/,
      timeout: 600_000,
      use: {
        ...devices["Desktop Chrome"],
        navigationTimeout: 180_000,
      },
    },
  ],
  webServer: {
    command: "npm run start -- -p 3001",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
