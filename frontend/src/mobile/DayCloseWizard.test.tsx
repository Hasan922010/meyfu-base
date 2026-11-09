import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { DayCloseWizard } from './DayCloseWizard';

const mockSubmit = vi.fn(() => Promise.resolve({ id: 'dc-1', status: 'SUBMITTED' }));
const mockMyToday = vi.fn();

vi.mock('@/shared/api/reports', () => ({
  dayCloseApi: {
    myToday: () => mockMyToday(),
    submit: (...args: unknown[]) => mockSubmit(...args),
  },
}));

vi.mock('@/shared/api/warehouse', () => ({
  warehouseApi: {
    warehouses: vi.fn(() =>
      Promise.resolve({
        results: [{ id: 'w1', name: 'Asosiy Ombor' }],
        count: 1,
      }),
    ),
  },
}));

vi.mock('@/offline/outbox', () => ({
  unsentCount: () => Promise.resolve(0),
}));

function renderWithClient(ui: React.ReactElement): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const TODAY_DATA = {
  submitted: false,
  sales_count: 5,
  sold_amount: '1200000.00',
  cash_sales_amount: '800000.00',
  debt_collected_amount: '150000.00',
  cash_expected: '950000.00',
  van_items: [
    {
      product: 'p1',
      product_name: 'Sovun 100g',
      unit: 'dona',
      quantity: '20.000',
      wholesale_price: '5000',
    },
  ],
};

describe('DayCloseWizard — 3 Bosqichli Ergonomik Kun Yopish', () => {
  beforeEach(() => {
    mockSubmit.mockClear();
    mockMyToday.mockResolvedValue(TODAY_DATA);
  });

  it('3 bosqichli ko‘rsatkich, tovar qaytarish va naqd pul kiritish to‘liq ishlaydi', async () => {
    renderWithClient(<DayCloseWizard />);

    // 1. 3 bosqichli ko'rsatkich ko'rinishi
    expect(await screen.findByRole('tablist', { name: 'Kun yopish bosqichlari' })).toBeInTheDocument();
    expect(screen.getByText('Tovar')).toBeInTheDocument();
    expect(screen.getByText('Pul')).toBeInTheDocument();
    expect(screen.getByText('Tasdiq')).toBeInTheDocument();

    // 2. 1-bosqich: Tovar qaytarish
    expect(screen.getByText('Sovun 100g')).toBeInTheDocument();
    expect(screen.getByText('tizimda: 20 dona')).toBeInTheDocument();

    // "0 qoldirish" tugmasi bosilganda miqdor 0 bo'ladi
    const zeroBtn = screen.getByRole('button', { name: '0 qoldirish' });
    fireEvent.click(zeroBtn);

    const qtyInput = screen.getByRole('spinbutton', { name: 'Sovun 100g — qaytariladigan miqdor' });
    expect(qtyInput).toHaveValue(0);

    // "Hammasi" tugmasi bosilganda miqdor 20 bo'ladi
    const allBtn = screen.getByRole('button', { name: 'Hammasi' });
    fireEvent.click(allBtn);
    expect(qtyInput).toHaveValue(20);

    // 3. 2-bosqichga o'tish
    const nextPulBtn = screen.getByRole('button', { name: /Keyingi: Pul/ });
    fireEvent.click(nextPulBtn);

    // 4. 2-bosqich: Naqd pul hisobi
    expect(screen.getByText('Bugungi tushumlar hisobi')).toBeInTheDocument();
    expect(screen.getAllByText(/950 000/).length).toBeGreaterThanOrEqual(1);

    // Kutilgan summani qo'yish
    const setExpectedBtn = screen.getByRole('button', { name: "Kutilgan summani qo'yish" });
    fireEvent.click(setExpectedBtn);

    expect(screen.getByText(/Kassa farqi yo'q/)).toBeInTheDocument();

    // 5. 3-bosqichga o'tish: Yakuniy tasdiq
    const nextConfirmBtn = screen.getByRole('button', { name: /Keyingi/ });
    fireEvent.click(nextConfirmBtn);

    expect(screen.getByText('Yakuniy hisobotni tekshirish')).toBeInTheDocument();
    expect(screen.getByText('Sotuvlar soni')).toBeInTheDocument();

    // 6. Kunni yopish tugmasini bosish
    const closeDayBtn = screen.getByRole('button', { name: 'Kunni yopish' });
    fireEvent.click(closeDayBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouse: 'w1',
          cash_handed: '950000',
          items: [
            expect.objectContaining({
              product: 'p1',
              quantity: '20',
              condition: 'GOOD',
            }),
          ],
        }),
      );
    });

    // 7. Muvaffaqiyatli yakunlangach "Kun yopildi" xabari ko'rinadi
    expect(await screen.findByText('Kun yopildi')).toBeInTheDocument();
  });
});
