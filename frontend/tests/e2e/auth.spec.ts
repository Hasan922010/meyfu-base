import { expect, test } from '@playwright/test';

import { collectConsoleErrors, login, USERS } from './helpers';

test('himoyalangan sahifa auth\'siz → /login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
});

test('login → bosh sahifa → sahifa yangilanganda auth saqlanadi', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await login(page, 'admin');
  await expect(page).toHaveURL(/\/(admin|m)/);

  await page.reload();
  await expect(page).not.toHaveURL(/\/login/);

  expect(errors, `Konsol xatolari: ${errors.join('\n')}`).toEqual([]);
});

test('noto\'g\'ri parol → aniq xato, redirect yo\'q', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox').first().fill(USERS.admin.phone);
  await page.locator('input[type="password"]').fill('wrong-password');
  await page.getByRole('button', { name: /kirish|sign in|войти/i }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('text=/noto|неверн|invalid/i')).toBeVisible();
});
