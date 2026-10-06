import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against the dev server on 5179. Uses the locally installed Chrome, so no browser
 * download is needed. The discovery/transfer specs talk to real STUN servers and Nostr relays.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5179',
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome', defaultBrowserType: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5179',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
