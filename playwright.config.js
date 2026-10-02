import { defineConfig, devices } from '@playwright/test'

// E2E テスト（npm run test:e2e）。毎回ビルドしてから vite preview で配信し、外部への通信は e2e/fixtures.js で差し替える
const PORT = 4179
const BASE_URL = `http://localhost:${PORT}/filmarks-watchlist-site/`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: '**/mobile.e2e.js' },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: '**/mobile.e2e.js' },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
