import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const companyApi = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/shared/api/company', () => ({ companyApi }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: 'SUPER_ADMIN' } }),
}));

import { CompanySettingsForm } from './CompanySettingsForm';

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CompanySettingsForm />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CompanySettingsForm — yuklama so‘z bilan sozlamasi', () => {
  it('sozlamani yuklaydi, o‘chiradi va serverga yuboradi', async () => {
    companyApi.get.mockResolvedValue({
      id: 'cs-1',
      name: 'Meyfu',
      legal_name: 'Meyfu MCHJ',
      inn: '123456789',
      address: 'Toshkent',
      phone: '+998901234567',
      bank_details: '',
      director_name: 'Ali',
      logo: null,
      stamp: null,
      loading_total_in_words: true,
      updated_at: '2026-11-17T08:00:00Z',
    });
    companyApi.update.mockResolvedValue({});

    renderForm();

    const checkbox = await screen.findByRole<HTMLInputElement>('checkbox', {
      name: /Yuklama hujjatida jami summani so‘z bilan ko‘rsatish/,
    });
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => {
      expect(companyApi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Meyfu',
          loading_total_in_words: false,
        }),
      );
    });
  });
});
