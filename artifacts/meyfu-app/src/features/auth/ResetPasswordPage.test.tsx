import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestPasswordReset, confirmPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));
vi.mock('@/shared/api/auth', () => ({ requestPasswordReset, confirmPasswordReset }));

import i18n from '@/locales/i18n';

import { ResetPasswordPage } from './ResetPasswordPage';

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<p>Kirish sahifasi</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function sendCode(phone = '901112233'): Promise<void> {
  fireEvent.change(screen.getByLabelText('Telefon raqami'), { target: { value: phone } });
  fireEvent.click(screen.getByRole('button', { name: 'Kod yuborish' }));
  await screen.findByLabelText('Tasdiqlash kodi');
}

beforeEach(async () => {
  requestPasswordReset.mockReset().mockResolvedValue(undefined);
  confirmPasswordReset.mockReset().mockResolvedValue(undefined);
  await i18n.changeLanguage('uz');
});

describe('ResetPasswordPage', () => {
  it('telefonsiz kod so‘ralmaydi', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Kod yuborish' }));

    expect(screen.getByText('Telefon raqamini kiriting')).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('kod so‘ralgach kod va yangi parol maydonlari chiqadi', async () => {
    renderPage();

    await sendCode();

    expect(requestPasswordReset.mock.calls[0]?.[0]).toBe('901112233');
    expect(screen.getByLabelText('Yangi parol')).toBeInTheDocument();
  });

  it('noto‘g‘ri formatdagi kod va qisqa parol yuborilmaydi', async () => {
    renderPage();
    await sendCode();
    fireEvent.change(screen.getByLabelText('Tasdiqlash kodi'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Yangi parol'), { target: { value: 'abc' } });

    fireEvent.click(screen.getByRole('button', { name: 'Parolni saqlash' }));

    expect(screen.getByText('6 xonali kodni kiriting')).toBeInTheDocument();
    expect(screen.getByText("Parol kamida 8 belgidan iborat bo'lsin")).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('muvaffaqiyatli tiklangach xabar va kirish havolasi chiqadi', async () => {
    renderPage();
    await sendCode();
    fireEvent.change(screen.getByLabelText('Tasdiqlash kodi'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('Yangi parol'), { target: { value: 'yangiParol1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Parolni saqlash' }));

    expect(
      await screen.findByText('Parol yangilandi. Endi yangi parol bilan kiring.'),
    ).toBeInTheDocument();
    expect(confirmPasswordReset.mock.calls[0]?.[0]).toEqual({
      phone: '901112233',
      code: '123456',
      new_password: 'yangiParol1',
    });
    expect(screen.getByRole('link', { name: 'Kirish sahifasiga qaytish' })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
