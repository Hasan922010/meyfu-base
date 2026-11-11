import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { reportsAdvancedApi } from '@/shared/api/reportsAdvanced';
import type { PaginatedData } from '@/shared/types/api';
import type { Category } from '@/shared/types/catalog';
import { ProductMovementTab } from './ProductMovementTab';

vi.mock('@/shared/api/catalog', () => ({
  catalogApi: {
    categories: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('@/shared/api/reportsAdvanced', () => ({
  reportsAdvancedApi: {
    productMovement: vi.fn(),
    exportProductMovement: vi.fn(),
  },
  downloadBlob: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ProductMovementTab', () => {
  it('sotuv va bepul aksiya bonuslari hisobotini to‘g‘ri aks ettiradi', async () => {
    vi.mocked(reportsAdvancedApi.productMovement).mockResolvedValueOnce({
      date_from: '2026-11-01',
      date_to: '2026-11-09',
      rows: [
        {
          product_id: 'p1',
          product_name: 'Shirin Konfet 1kg',
          product_sku: 'CONF-1KG',
          category_name: 'Shirinliklar',
          unit: 'kg',
          has_bonus: true,
          bonus_trigger_qty: '10.00',
          bonus_reward_qty: '1.00',
          sold_qty: '100',
          sold_amount: '5000000',
          bonus_qty: '10',
          bonus_cost: '350000',
          total_qty: '110',
          avg_price: '50000',
          sales_count: 8,
        },
        {
          product_id: 'p2',
          product_name: 'Premium Choy',
          product_sku: 'TEA-100',
          category_name: 'Choylar',
          unit: 'quti',
          has_bonus: false,
          bonus_trigger_qty: '0.00',
          bonus_reward_qty: '0.00',
          sold_qty: '50',
          sold_amount: '1500000',
          bonus_qty: '0',
          bonus_cost: '0',
          total_qty: '50',
          avg_price: '30000',
          sales_count: 5,
        },
      ],
      summary: {
        total_products: 2,
        total_sold_qty: '150',
        total_sold_amount: '6500000',
        total_bonus_qty: '10',
        total_bonus_cost: '350000',
        total_movement_qty: '160',
        bonus_ratio_percent: '6.25',
      },
    });

    renderWithClient(
      <ProductMovementTab range={{ date_from: '2026-11-01', date_to: '2026-11-09' }} />,
    );

    // KPI kartochkalar
    expect(await screen.findByText('Jami Pullik Sotuv')).toBeInTheDocument();
    expect(screen.getByText('Aksiya Bonusi (BEPUL)')).toBeInTheDocument();
    expect(screen.getByText('10 dona')).toBeInTheDocument();
    expect(screen.getByText(/Tannarxi: 350 000.*so'm/)).toBeInTheDocument();
    expect(screen.getByText('Jami Ombor Chiqimi')).toBeInTheDocument();
    expect(screen.getByText('160 dona')).toBeInTheDocument();

    // Jadval qatorlari
    expect(screen.getByText('Shirin Konfet 1kg')).toBeInTheDocument();
    expect(screen.getByText('Premium Choy')).toBeInTheDocument();
    expect(screen.getByText(/\+10.*kg/)).toBeInTheDocument();
  });

  it('paginatsiyalangan kategoriyalar obyektini xatosiz qabul qiladi', async () => {
    const { catalogApi } = await import('@/shared/api/catalog');
    vi.mocked(catalogApi.categories).mockResolvedValueOnce({
      count: 2,
      results: [
        { id: 'cat-1', name: 'Ichimliklar' },
        { id: 'cat-2', name: 'Shirinliklar' },
      ],
    } as unknown as PaginatedData<Category>);

    vi.mocked(reportsAdvancedApi.productMovement).mockResolvedValueOnce({
      date_from: '2026-11-01',
      date_to: '2026-11-09',
      rows: [],
      summary: {
        total_products: 0,
        total_sold_qty: '0',
        total_sold_amount: '0',
        total_bonus_qty: '0',
        total_bonus_cost: '0',
        total_movement_qty: '0',
        bonus_ratio_percent: '0',
      },
    });

    renderWithClient(
      <ProductMovementTab range={{ date_from: '2026-11-01', date_to: '2026-11-09' }} />,
    );

    expect(await screen.findByRole('option', { name: 'Ichimliklar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Shirinliklar' })).toBeInTheDocument();
  });
});
