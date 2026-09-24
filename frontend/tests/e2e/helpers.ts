import { expect, type Page } from '@playwright/test';

// seed_demo yaratadigan foydalanuvchilar
export const USERS = {
  admin: { phone: '+998900000000', password: 'Hasanali.0220' },
  manager: { phone: '+998901000000', password: 'demo12345' },
  distributor: { phone: '+998903000000', password: 'demo12345' },
  accountant: { phone: '+998904000000', password: 'demo12345' },
} as const;

export async function login(
  page: Page,
  who: keyof typeof USERS = 'admin',
): Promise<void> {
  const u = USERS[who];
  await page.goto('/login');
  await page.getByRole('textbox').first().fill(u.phone);
  await page.locator('input[type="password"]').fill(u.password);
  await page.getByRole('button', { name: /kirish|sign in|войти/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Sahifa yuklanganda konsol xatolari yig'iladi. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}
