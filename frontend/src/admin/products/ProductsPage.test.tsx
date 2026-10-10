import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalogApi = vi.hoisted(() => ({
  products: vi.fn(),
  categories: vi.fn(),
}));

vi.mock('@/shared/api/catalog', () => ({ catalogApi }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: 'MANAGER' } }),
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
    retail_price: '30000',
    min_price: '25000',
    is_active: true,
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
    retail_price: '22000',
    min_price: '18000',
    is_active: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  catalogApi.categories.mockResolvedValue(page([{ id: 'c1', name: 'Kukunlar' }]));
  catalogApi.products.mockImplementation((params?: { search?: string }) => {
    let res = [...mockProducts];
    if (params?.search) {
      const q = params.search.toLowerCase();
      res = res.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return Promise.resolve(page(res));
  });
});

describe('ProductsPage', () => {
  it('renders products and filters when typing in search input', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ProductsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Bio kukun 3kg')).toBeInTheDocument();
    expect(screen.getByText('Yuvish geli 1L')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Qidirish…');
    fireEvent.change(searchInput, { target: { value: 'Bio' } });

    await waitFor(
      () => {
        expect(catalogApi.products).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'Bio' }),
        );
      },
      { timeout: 1000 },
    );
  });
});
