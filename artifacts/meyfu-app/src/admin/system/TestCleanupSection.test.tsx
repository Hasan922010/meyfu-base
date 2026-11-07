import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from '@/admin/SettingsPage';
import { TestCleanupSection } from '@/admin/system/TestCleanupSection';
import { systemApi } from '@/shared/api/system';
import { useAuthStore } from '@/shared/store/authStore';

vi.mock('@/shared/api/system', () => ({
  systemApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    cleanupEntries: vi.fn(),
    cleanupPreview: vi.fn(),
    cleanupExecute: vi.fn(),
  },
}));

vi.mock('@/shared/api/company', () => ({
  companyApi: {
    get: vi.fn().mockResolvedValue({
      id: '1',
      name: 'MeyFu',
      legal_name: 'MeyFu LLC',
      inn: '123456789',
      address: 'Toshkent',
      phone: '+998901234567',
      bank_details: '',
      director_name: 'Admin',
      logo: null,
      stamp: null,
      updated_at: '2026-11-07T00:00:00Z',
    }),
    update: vi.fn(),
  },
}));

vi.mock('@/shared/components/TelegramConnect', () => ({
  TelegramConnect: () => <div>TelegramConnect</div>,
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPage va TestCleanupSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        phone: '+998900000000',
        full_name: 'Bosh Admin',
        role: 'SUPER_ADMIN',
        avatar: null,
        passport_series: '',
        address: '',
        hire_date: null,
        is_active: true,
        last_seen_at: null,
        telegram_chat_id: '',
        warehouse: null,
        warehouse_name: null,
      },
      access: 'tok',
      refresh: 'ref',
    });
  });

  it("Sozlamalar sahifasida tozalash ruxsatini yoqib-o'chiradi", async () => {
    vi.mocked(systemApi.getSettings).mockResolvedValue({
      allow_test_cleanup: true,
    });
    vi.mocked(systemApi.updateSettings).mockResolvedValue({
      allow_test_cleanup: false,
    });

    renderWithProviders(<SettingsPage />);

    const toggle = await screen.findByRole('switch', {
      name: /Soxta tranzaksiyalarni tozalashga ruxsat berish/i,
    });
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    await userEvent.click(toggle);

    await waitFor(() => {
      expect(systemApi.updateSettings).toHaveBeenCalledWith({
        allow_test_cleanup: false,
      });
    });
  });

  it('TestCleanupSection operatsiyalarni tanlab preview va execute qiladi', async () => {
    vi.mocked(systemApi.cleanupEntries).mockResolvedValue({
      ledger: 'finance.cashtransaction',
      allow_test_cleanup: true,
      entries: [
        {
          id: 'tx-11112222',
          date: '2026-11-07',
          created_at: '2026-11-07T10:00:00Z',
          type_code: 'CORRECTION',
          type_display: 'Tuzatish',
          target_name: 'Asosiy kassa',
          counterparty: '',
          amount: '50000.00',
          balance_after: '150000.00',
          reference_type: 'manual',
          reference_id: '',
          note: 'Test kassa yozuvi',
          actor_name: 'Bosh Admin',
        },
      ],
    });

    vi.mocked(systemApi.cleanupPreview).mockResolvedValue({
      ledger: 'finance.cashtransaction',
      selected_ids: ['tx-11112222'],
      rows: [
        {
          model: 'finance.cashtransaction',
          id: 'tx-11112222',
          label: 'Asosiy kassa: +50000.00',
          fields: { amount: '50000.00' },
        },
      ],
      effects: [
        {
          model: 'finance.cashaccount',
          id: 'acc-1',
          label: 'Asosiy kassa',
          changes: [
            {
              field: 'balans',
              field_name: 'balance',
              old: '150000.00',
              new: '100000.00',
            },
          ],
        },
      ],
      digest: 'abc123digest',
      cleanup_token: 'signed-token-xyz',
    });

    vi.mocked(systemApi.cleanupExecute).mockResolvedValue({
      cleaned_count: 1,
      message: '1 ta soxta/bog‘liq yozuv faol hisoblardan chiqarildi.',
    });

    renderWithProviders(<TestCleanupSection />);

    expect(await screen.findByText('Test kassa yozuvi')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Test kassa yozuvi'));

    const previewBtn = screen.getByRole('button', {
      name: /Tanlanganlarni tozalash \(1\)/i,
    });
    await userEvent.click(previewBtn);

    expect(
      await screen.findByText(/Faol hisoblardan chiqariladigan yozuvlar/i),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText(/Sinov paytida kiritilgan test operatsiya/i),
      'Test yozuvni tozalash',
    );
    await userEvent.type(
      screen.getByPlaceholderText('TOZALASH'),
      'TOZALASH',
    );
    await userEvent.type(
      screen.getByPlaceholderText('••••••••'),
      'admin12345',
    );
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /Bog‘liq yozuvlar va balans ta’sirini tekshirdim/i,
      }),
    );

    const confirmBtn = screen.getByRole('button', {
      name: /Tasdiqlab tozalash/i,
    });
    await waitFor(() => {
      expect(confirmBtn).not.toBeDisabled();
    });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(systemApi.cleanupExecute).toHaveBeenCalledWith({
        ledger: 'finance.cashtransaction',
        ids: ['tx-11112222'],
        cleanup_token: 'signed-token-xyz',
        reason: 'Test yozuvni tozalash',
        confirmation: 'TOZALASH',
        password: 'admin12345',
        acknowledged: true,
      });
    });
  });
});
