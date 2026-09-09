import { defineConfig, devices } from '@playwright/test';

// Audit E2E-001 — Bosqich 8: brauzerda real smoke testlar.
// Backend (sqlite + seed_demo) va frontend dev serverini o'zi ko'taradi.
//
//   npm run e2e
//
// Birinchi marta: `npx playwright install chromium`.

const FRONTEND_PORT = 5175; // dev serverdan (5173) alohida — bir vaqtda ishlashi mumkin
const BACKEND_PORT = 8010;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile\.spec\.ts$/,
    },
  ],
  webServer: [
    {
      // Har ishga tushishda toza e2e.sqlite3 (repo'dagi local.sqlite3 ga tegmaydi)
      command:
        'node -e "require(\'fs\').rmSync(\'e2e.sqlite3\',{force:true})" && ' +
        'python manage.py migrate --noinput && ' +
        'python manage.py seed_demo && ' +
        `python manage.py runserver ${BACKEND_PORT} --noreload`,
      cwd: '../backend',
      env: {
        DJANGO_SETTINGS_MODULE: 'config.settings.e2e',
        PYTHONUTF8: '1',
        TELEGRAM_BOT_TOKEN: '', // E2E paytida real Telegram yuborishlari yo'q
        ANTHROPIC_API_KEY: '',
      },
      port: BACKEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      env: { VITE_PROXY_TARGET: `http://localhost:${BACKEND_PORT}` },
      port: FRONTEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
