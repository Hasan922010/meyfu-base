import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const warehouseApi = vi.hoisted(() => ({
  suppliers: vi.fn(),
  warehouses: vi.fn(),
  createPurchase: vi.fn(),
}));

const catalogApi = vi.hoisted(() => ({
  products: vi.fn(),
}));

vi.mock('@/shared/api/warehouse', () => ({ warehouseApi }));
vi.mock('@/shared/api/catalog', () => ({ catalogApi }));

import { MobileReceivePage } from './MobileReceivePage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MobileReceivePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  warehouseApi.suppliers.mockResolvedValue({
    results: [{ id: 'sup-1', name: 'Meyfu Zavod' }],
  });
  warehouseApi.warehouses.mockResolvedValue({
    results: [{ id: 'wh-1', name: 'Asosiy ombor' }],
  });
  catalogApi.products.mockResolvedValue({
    results: [
      {
        id: 'p-pack',
        name: 'Poroshok 900gr',
        sku: 'P-900',
        barcode: '',
        unit_name: 'dona',
        cost_price: '12600.00',
        pack_quantity: '10.000',
        package_type: 'qop',
        is_active: true,
      },
    ],
  });
  warehouseApi.createPurchase.mockResolvedValue({ id: 'pur-1', number: 'KIR-001' });
});

describe('MobileReceivePage — qadoq/quti birligida kirim', () => {
  it('qadoqli tovarni qopda kiritib, bazaviy donaga ko‘paytirib yuboradi', async () => {
    renderPage();

    const searchInput = await screen.findByPlaceholderText(/Mahsulot qidirish/);
    fireEvent.change(searchInput, { target: { value: 'Poroshok' } });

    fireEvent.click(await screen.findByRole('button', { name: /Poroshok 900gr/ }));

    expect(screen.getByText('Soni (qop)')).toBeInTheDocument();
    const qtyInput = screen.getByRole('spinbutton');
    fireEvent.change(qtyInput, { target: { value: '2' } });

    expect(screen.getByText('2 qop × 10 dona = 20 dona')).toBeInTheDocument();
    expect(screen.getAllByText("252 000 so'm").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: 'Qabulni saqlash' }));

    await waitFor(() => {
      expect(warehouseApi.createPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          supplier: 'sup-1',
          warehouse: 'wh-1',
          items: [
            {
              product: 'p-pack',
              quantity: '2',
              cost_price: '126000',
            },
          ],
        }),
      );
    });
  });
});
