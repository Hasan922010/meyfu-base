import { expect, test } from '@playwright/test';

import { collectConsoleErrors, login } from './helpers';

const ADMIN_PAGES = [
  '/admin',
  '/admin/products',
  '/admin/clients',
  '/admin/sales',
  '/admin/warehouse',
  '/admin/day-close',
  '/admin/reports',
  '/admin/settings',
];

test('admin sahifalari konsol xatosisiz ochiladi', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await login(page, 'admin');

  for (const path of ADMIN_PAGES) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
  }

  const real = errors.filter((e) => !/favicon|ResizeObserver/i.test(e));
  expect(real, real.join('\n')).toEqual([]);
});

test('backend xatosi → tushunarli xabar (oq ekran emas)', async ({ page }) => {
  await login(page, 'admin');
  // API so'rovlarini 500 ga aylantiramiz
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('/admin/products');

  // Ilova hali ko'rinadi (ErrorBoundary / xato holati), oq ekran emas
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(
    page.locator('text=/xato|xatolik|server|qayta/i').first(),
  ).toBeVisible({ timeout: 10_000 });
});
