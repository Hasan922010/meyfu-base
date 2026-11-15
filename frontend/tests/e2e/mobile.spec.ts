import { expect, test } from '@playwright/test';

import { collectConsoleErrors, login } from './helpers';

test('tarqatuvchi qarz undirishda qisman summa kiritganda fokus saqlanadi va tolov saqlanadi', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await login(page, 'distributor');

  await page.goto('/m/debts');
  await expect(page.getByRole('heading', { name: 'Qarz undirish' })).toBeVisible();

  const firstDebtor = page.locator('ul li button').first();
  await expect(firstDebtor).toBeVisible();
  await firstDebtor.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const amountInput = dialog.getByLabel("To'lov summasi");
  await amountInput.click();
  await amountInput.fill('');
  await amountInput.pressSequentially('50000');

  await expect(amountInput).toBeFocused();
  await expect(amountInput).toHaveValue('50000');

  await dialog.getByRole('button', { name: "To'lovni qabul qilish" }).click();
  await expect(dialog.getByText("To'lov saqlandi")).toBeVisible();

  const real = errors.filter((e) => !/favicon|ResizeObserver/i.test(e));
  expect(real, real.join('\n')).toEqual([]);
});
