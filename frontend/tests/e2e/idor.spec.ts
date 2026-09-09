import { expect, test } from '@playwright/test';

import { login } from './helpers';

test('tarqatuvchi boshqa tarqatuvchi 360°-kartasini ochsa — rad etiladi', async ({
  page,
  request,
}) => {
  await login(page, 'distributor');

  // Token bilan boshqa foydalanuvchi id'sini so'rab ko'ramiz (API darajasida IDOR)
  const token = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('meyfu-auth') ?? '{}').state?.access;
    } catch {
      return null;
    }
  });
  expect(token).toBeTruthy();

  // manager id'sini admin sifatida bilib bo'lmaydi — mavjud bo'lmagan/begona UUID
  const strangerId = '00000000-0000-4000-8000-000000000000';
  const res = await request.get(
    `http://localhost:8010/api/v1/reports/distributor/${strangerId}/full/`,
    { headers: { Authorization: `Bearer ${token as string}` } },
  );
  expect([403, 404]).toContain(res.status());
});

test('tarqatuvchi admin sahifasiga kira olmaydi', async ({ page }) => {
  await login(page, 'distributor');
  await page.goto('/admin');
  // ProtectedRoute rolni tekshiradi → login yoki mobil bosh sahifaga
  await expect(page).not.toHaveURL(/\/admin(\/|$)/);
});
