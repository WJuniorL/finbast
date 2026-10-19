import { defineConfig } from "@playwright/test";

process.loadEnvFile(".env.local");
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100", channel: "msedge", trace: "off", actionTimeout: 15000 },
});
