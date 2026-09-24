import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { login } = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('@/shared/api/auth', () => ({ login }));

import i18n from '@/locales/i18n';
import { useAuthStore } from '@/shared/store/authStore';

import { LoginPage } from './LoginPage';

function renderLogin(): void {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Bosh sahifa</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  login.mockReset();
  useAuthStore.getState().clear();
  await i18n.changeLanguage('uz');
});

describe('LoginPage (login formasi tekshiruvi)', () => {
  it('ochilganda fokus telefon maydonida', () => {
    renderLogin();

    expect(screen.getByLabelText('Telefon raqami')).toHaveFocus();
  });

  it('bo‘sh yuborilsa o‘zbekcha xabar chiqadi va so‘rov yuborilmaydi', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Tizimga kirish' }));

    expect(screen.getByText('Telefon raqamini kiriting')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon raqami')).toHaveAttribute('aria-invalid', 'true');
    expect(login).not.toHaveBeenCalled();
  });

  it('parolsiz yuborilsa parol haqida xabar chiqadi', () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText('Telefon raqami'), { target: { value: '903000000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Tizimga kirish' }));

    expect(screen.getByText('Parolni kiriting')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('parolni ko‘rsatish tugmasi maydon turini almashtiradi', () => {
    renderLogin();
    const pw = screen.getByLabelText('Parol');
    expect(pw).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: "Parolni ko'rsatish" }));

    expect(pw).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Parolni yashirish' })).toBeInTheDocument();
  });

  it('tizimga kirgan foydalanuvchi bosh sahifaga yo‘naltiriladi', () => {
    useAuthStore.getState().setSession({
      access: 'a',
      refresh: 'r',
      user: { id: 'u', full_name: 'T', role: 'DISTRIBUTOR' } as never,
    });

    renderLogin();

    expect(screen.getByText('Bosh sahifa')).toBeInTheDocument();
  });

  it('til almashtirgich va parolni unutganlar uchun yo‘l-yo‘riq bor', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Русский' }));

    expect(screen.getByRole('button', { name: 'Войти в систему' })).toBeInTheDocument();
    expect(screen.getByText(/администратор/i)).toBeInTheDocument();
  });
});
