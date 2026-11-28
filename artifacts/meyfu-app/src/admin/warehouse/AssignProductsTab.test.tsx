import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { catalogApi, warehouseApi } = vi.hoisted(() => ({
  catalogApi: {
    products: vi.fn(),
    categories: vi.fn(),
    assignWarehouse: vi.fn(),
  },
  warehouseApi: {
    warehouses: vi.fn(),
  },
}));

vi.mock('@/shared/api/catalog', () => ({ catalogApi }));
vi.mock('@/shared/api/warehouse', () => ({ warehouseApi }));

import { ToastContext } from '@/shared/lib/toast';

import { AssignProductsTab } from './AssignProductsTab';

const push = vi.fn();

const page = <T,>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
  page: 1,
  pages: 1,
  page_size: 50,
});

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ToastContext.Provider value={{ push }}>
        <AssignProductsTab />
      </ToastContext.Provider>
    </QueryClientProvider>,
  );
}

describe('AssignProductsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    warehouseApi.warehouses.mockResolvedValue(
      page([
        { id: 'wh-1', name: 'Asosiy ombor' },
        { id: 'wh-2', name: 'Ikkinchi ombor' },
      ]),
    );
    catalogApi.categories.mockResolvedValue(page([{ id: 'c1', name: 'Ichimliklar' }]));
    catalogApi.products.mockResolvedValue(
      page([
        {
          id: 'p1',
          name: 'Olma sharbati',
          sku: 'JUICE-1',
          category_name: 'Ichimliklar',
          warehouse: null,
          warehouse_name: null,
          unit_name: 'dona',
          pack_quantity: '1',
          package_type: '',
          available_stock: 15,
        },
      ]),
    );
    catalogApi.assignWarehouse.mockResolvedValue({
      warehouse: 'wh-2',
      warehouse_name: 'Ikkinchi ombor',
      requested: 1,
      updated: 1,
    });
  });

  it('mahsulotni tanlab omborga biriktiradi va unassigned filtrini ishlatadi', async () => {
    renderTab();

    expect(await screen.findByText('Olma sharbati')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ombor biriktirilmagan' }));
    await waitFor(() => {
      expect(catalogApi.products).toHaveBeenCalledWith(
        expect.objectContaining({ unassigned: 'true' }),
        expect.any(AbortSignal),
      );
    });

    fireEvent.click(screen.getByLabelText('Olma sharbati ni tanlash'));
    fireEvent.change(screen.getByLabelText('Biriktiriladigan omborni tanlang'), {
      target: { value: 'wh-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Omborga biriktirish \(1\)/ }));

    await waitFor(() => {
      expect(catalogApi.assignWarehouse).toHaveBeenCalledWith({
        ids: ['p1'],
        warehouse: 'wh-2',
      });
    });
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'success',
      }),
    );
  });
});
