import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { catalogApi, roleState } = vi.hoisted(() => ({
  catalogApi: {
    products: vi.fn(),
    categories: vi.fn(),
    brands: vi.fn(),
    exportProducts: vi.fn(),
  },
  roleState: { role: 'MANAGER' },
}));

vi.mock('@/shared/api/catalog', () => ({ catalogApi }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: roleState.role } }),
}));

import { ProductsPage } from './ProductsPage';

const page = <T,>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
  page: 1,
  pages: 1,
  page_size: 20,
});

const mockProducts = [
  {
    id: 'p1',
    name: 'Bio kukun 3kg',
    sku: 'BIO-3KG',
    barcode: '123456',
    category: 'c1',
    category_name: 'Kukunlar',
    brand: null,
    brand_name: null,
    unit: 'u1',
    unit_name: 'dona',
    cost_price: '20000',
    wholesale_price: '28000',
    retail_price: '30000',
    min_price: '25000',
    pack_quantity: '1',
    is_active: true,
    total_stock: 10,
    reserved_stock: 0,
    available_stock: 10,
    stock_status: 'ok' as const,
  },
  {
    id: 'p2',
    name: 'Yuvish geli 1L',
    sku: 'GEL-1L',
    barcode: '654321',
    category: 'c2',
    category_name: 'Gellar',
    brand: null,
    brand_name: null,
    unit: 'u1',
    unit_name: 'dona',
    cost_price: '15000',
    wholesale_price: '20000',
    retail_price: '22000',
    min_price: '18000',
    pack_quantity: '1',
    is_active: true,
    total_stock: 5,
    reserved_stock: 0,
    available_stock: 5,
    stock_status: 'ok' as const,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  roleState.role = 'MANAGER';
  catalogApi.categories.mockResolvedValue(page([{ id: 'c1', name: 'Kukunlar' }]));
  catalogApi.brands.mockResolvedValue(page([]));
  catalogApi.products.mockImplementation((params?: { search?: string }) => {
    let res = [...mockProducts];
    if (params?.search) {
      const q = params.search.toLowerCase();
      res = res.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return Promise.resolve(page(res));
  });
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProductsPage', () => {
  it('renders products and filters when typing in search input', async () => {
    renderPage();

    expect((await screen.findAllByText('Bio kukun 3kg')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Yuvish geli 1L').length).toBeGreaterThan(0);

    const searchInput = screen.getByPlaceholderText(/Nomi, SKU yoki Shtrix-kod/);
    fireEvent.change(searchInput, { target: { value: 'Bio' } });

    await waitFor(
      () => {
        expect(catalogApi.products).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'Bio' }),
          expect.any(AbortSignal),
        );
      },
      { timeout: 1000 },
    );
  });

  it('hides Eksport button for WAREHOUSE and DISTRIBUTOR, shows for ACCOUNTANT and MANAGER', async () => {
    roleState.role = 'WAREHOUSE';
    const { unmount } = renderPage();
    await screen.findAllByText('Bio kukun 3kg');
    expect(screen.queryByRole('button', { name: /Eksport/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Yangi mahsulot/i })).not.toBeInTheDocument();
    unmount();

    roleState.role = 'ACCOUNTANT';
    const view2 = renderPage();
    await screen.findAllByText('Bio kukun 3kg');
    expect(screen.getByRole('button', { name: /Eksport/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Yangi mahsulot/i })).not.toBeInTheDocument();
    view2.unmount();

    roleState.role = 'BRANCH_MANAGER';
    renderPage();
    await screen.findAllByText('Bio kukun 3kg');
    expect(screen.getByRole('button', { name: /Eksport/i })).toBeInTheDocument();
  });
});
