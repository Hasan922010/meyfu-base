import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const warehouseApi = vi.hoisted(() => ({ stock: vi.fn() }));
vi.mock('@/shared/api/warehouse', () => ({ warehouseApi }));

import { MobileStockPage } from './MobileStockPage';

const row = (over: Record<string, string>) => ({
  id: over.id,
  product_name: over.name,
  product_sku: over.id,
  product_unit: 'dona',
  quantity: over.qty,
  reserved_quantity: over.reserved ?? '0.000',
  available_quantity: over.qty,
  min_stock_alert: over.min ?? '0.000',
});

describe('MobileStockPage (audit m9)', () => {
  it('birlik, band miqdor va "Kam qoldi" belgisini ko‘rsatadi', async () => {
    warehouseApi.stock.mockResolvedValue({
      count: 2, next: null, previous: null,
      results: [
        row({ id: 'a', name: 'Bio kukun 3kg', qty: '1320.000', reserved: '30.000', min: '20.000' }),
        row({ id: 'b', name: 'Kir sovuni', qty: '5.000', min: '20.000' }),
      ],
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MobileStockPage />
      </QueryClientProvider>,
    );

    const bio = (await screen.findByText('Bio kukun 3kg')).closest('li') as HTMLElement;
    expect(within(bio).getByText('1 320 dona')).toBeInTheDocument();
    expect(within(bio).getByText(/band: 30/)).toBeInTheDocument();
    expect(within(bio).queryByText('Kam qoldi')).not.toBeInTheDocument();

    const soap = screen.getByText('Kir sovuni').closest('li') as HTMLElement;
    expect(within(soap).getByText('Kam qoldi')).toBeInTheDocument();
  });
});
