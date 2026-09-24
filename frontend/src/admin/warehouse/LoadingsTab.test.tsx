import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const warehouseApi = vi.hoisted(() => ({
  loadings: vi.fn(),
  sendLoading: vi.fn(),
  cancelLoading: vi.fn(),
  updateLoading: vi.fn(),
  createLoading: vi.fn(),
  warehouses: vi.fn(),
  stock: vi.fn(),
  loadingPdf: vi.fn(),
}));
const catalogApi = vi.hoisted(() => ({ products: vi.fn() }));
const authApi = vi.hoisted(() => ({ distributors: vi.fn() }));
vi.mock('@/shared/api/warehouse', () => ({ warehouseApi }));
vi.mock('@/shared/api/catalog', () => ({ catalogApi }));
vi.mock('@/shared/api/users', () => ({ authApi }));
vi.mock('./PdfButtons', () => ({ PdfButtons: () => null }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: 'MANAGER' } }),
}));

import { LoadingsTab } from './LoadingsTab';

const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

const DRAFT = {
  id: 'l-draft',
  number: 'YK-2026-00010',
  date: '2026-09-24',
  distributor: 'd1',
  distributor_name: 'Sardor Tarqatuvchi',
  warehouse: 'w1',
  warehouse_name: 'Markaziy ombor',
  status: 'DRAFT',
  status_display: 'Qoralama',
  total_amount: '130000000.00',
  items: [{ product: 'p1', product_name: 'Bio kukun 3kg', quantity: '5000.000', price: '26000.00' }],
};
const SENT = { ...DRAFT, id: 'l-sent', number: 'YK-2026-00008', status: 'SENT', status_display: 'Yuborilgan' };

function renderTab(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LoadingsTab />
    </QueryClientProvider>,
  );
}

function row(number: string): HTMLElement {
  return screen.getByText(number).closest('tr') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  warehouseApi.loadings.mockResolvedValue(page([DRAFT, SENT]));
  warehouseApi.cancelLoading.mockResolvedValue({});
  warehouseApi.updateLoading.mockResolvedValue(DRAFT);
  warehouseApi.warehouses.mockResolvedValue(page([{ id: 'w1', name: 'Markaziy ombor' }]));
  warehouseApi.stock.mockResolvedValue(page([{ product: 'p1', available_quantity: '1320.000' }]));
  catalogApi.products.mockResolvedValue(page([{ id: 'p1', name: 'Bio kukun 3kg', sku: 'BIO-3KG', wholesale_price: '26000.00' }]));
  authApi.distributors.mockResolvedValue([{ id: 'd1', full_name: 'Sardor Tarqatuvchi' }]);
});

describe('LoadingsTab — qoralama va yuborilgan yuklama amallari', () => {
  it('qoralamani tasdiqlab o‘chiradi', async () => {
    renderTab();
    await screen.findByText('YK-2026-00010');

    fireEvent.click(within(row('YK-2026-00010')).getByRole('button', { name: "O'chirish" }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: "O'chirish" }));

    await waitFor(() => expect(warehouseApi.cancelLoading).toHaveBeenCalledWith('l-draft'));
  });

  it('yuborilgan yuklamani qaytarib olish mumkin', async () => {
    renderTab();
    await screen.findByText('YK-2026-00008');

    fireEvent.click(within(row('YK-2026-00008')).getByRole('button', { name: 'Qaytarib olish' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Qaytarib olish' }));

    await waitFor(() => expect(warehouseApi.cancelLoading).toHaveBeenCalledWith('l-sent'));
  });

  it('qoralamani tahrirlash oynasi mavjud qatorlar bilan ochiladi va saqlaydi', async () => {
    renderTab();
    await screen.findByText('YK-2026-00010');

    fireEvent.click(within(row('YK-2026-00010')).getByRole('button', { name: 'Tahrirlash' }));

    // Controlled select option'lar kelgach qiymatni ko'rsatadi
    await waitFor(() => expect(screen.getByLabelText('Tarqatuvchi *')).toHaveValue('d1'));
    await waitFor(() => expect(screen.getByLabelText('Ombor *')).toHaveValue('w1'));
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() =>
      expect(warehouseApi.updateLoading).toHaveBeenCalledWith(
        'l-draft',
        expect.objectContaining({
          distributor: 'd1',
          items: [expect.objectContaining({ product: 'p1', quantity: '5000' })],
        }),
      ),
    );
  });

  it('qatorda ombordagi qoldiq ko‘rinadi va undan oshsa ogohlantiradi', async () => {
    renderTab();
    await screen.findByText('YK-2026-00010');

    fireEvent.click(within(row('YK-2026-00010')).getByRole('button', { name: 'Tahrirlash' }));

    expect(await screen.findByText(/Omborda faqat 1 320 bor/)).toBeInTheDocument();
    expect(warehouseApi.stock).toHaveBeenCalledWith(expect.objectContaining({ warehouse: 'w1' }));
  });
});
