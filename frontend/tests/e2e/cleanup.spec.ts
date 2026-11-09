import { expect, test } from '@playwright/test';

import { login, USERS } from './helpers';

test('F11-H1: sozlamalarda tozalash ruxsatini boshqarish va tizim holatida tozalash tabini ochish', async ({
  page,
}) => {
  const serverErrors: string[] = [];
  page.on('pageerror', (err) => serverErrors.push(err.message));
  page.on('response', (res) => {
    if (res.status() >= 500) {
      serverErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  await login(page, 'admin');

  await page.goto('/admin/settings');
  await expect(
    page.getByText('Soxta tranzaksiyalarni tozalash ruxsati'),
  ).toBeVisible();

  await page.goto('/admin/system?tab=cleanup');
  await expect(
    page.getByText('Faqat sinov (test) jarayonidagi soxta operatsiyalarni tozalash uchun'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Kassa operatsiyalari' }),
  ).toBeVisible();

  expect(serverErrors).toEqual([]);
});

test('F11-H2: soxta operatsiyani preview va tasdiqlash orqali tozalash', async ({
  page,
}) => {
  await login(page, 'admin');

  await page.goto('/admin/system?tab=cleanup');
  await page
    .getByRole('button', {
      name: 'Xodim hamyoni operatsiyalari',
    })
    .click();

  const targetRowCheckbox = page
    .locator('tbody tr input[type="checkbox"]')
    .first();
  await expect(targetRowCheckbox).toBeVisible();
  await targetRowCheckbox.check();

  await page.getByRole('button', { name: /Tanlanganlarni tozalash/i }).click();
  await expect(
    page.getByText('Tanlangan soxta operatsiyalarni tozalashni tasdiqlash'),
  ).toBeVisible();

  await page
    .getByPlaceholder('Masalan: Sinov paytida kiritilgan test operatsiya')
    .fill('Playwright E2E sinov tozalash');
  await page.getByPlaceholder('TOZALASH').fill('TOZALASH');
  await page.getByPlaceholder('••••••••').fill(USERS.admin.password);
  await page
    .getByRole('checkbox', {
      name: /Bog‘liq yozuvlar va balans ta’sirini tekshirdim/i,
    })
    .check();

  const submitBtn = page.getByRole('button', { name: 'Tasdiqlab tozalash' });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  await expect(
    page.getByText(/ta soxta\/bog‘liq yozuv faol hisoblardan chiqarildi/i),
  ).toBeVisible();
});

