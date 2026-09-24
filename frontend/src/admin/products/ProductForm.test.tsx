import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalogApi = vi.hoisted(() => ({
  categories: vi.fn(),
  units: vi.fn(),
  brands: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));
vi.mock('@/shared/api/catalog', () => ({ catalogApi }));
vi.mock('./ProductImages', () => ({ ProductImages: () => null }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: 'SUPER_ADMIN' } }),
}));

import type { Product } from '@/shared/types/catalog';

import { ProductForm } from './ProductForm';

function serverFieldError(field: string, message: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Bad Request', 'ERR_BAD_REQUEST', config, null, {
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config,
    data: {
      success: false,
      error: { code: 'INVALID', message: 'Xato', details: { [field]: [message] } },
    },
  });
}

const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

const PRODUCT = {
  id: 'p1',
  name: 'Bio kukun 3kg',
  sku: 'BIO-3KG',
  barcode: '',
  category: 'c1',
  brand: 'b1',
  unit: 'u1',
  cost_price: '22000.00',
  wholesale_price: '26000.00',
  retail_price: '30000.00',
  min_price: '25000.00',
  pack_quantity: '1.000',
  commission_percent: '0.00',
  min_stock_alert: '20.000',
  is_active: true,
} as unknown as Product;

function renderForm(product: Product | null): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ProductForm product={product} onDone={() => undefined} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  catalogApi.categories.mockResolvedValue(page([{ id: 'c1', name: 'Kukunlar' }]));
  catalogApi.brands.mockResolvedValue(page([{ id: 'b1', name: 'Global Chem' }]));
  // Birliklar kechikib keladi — birinchi ochilishdagi poyga (race) holati
  catalogApi.units.mockImplementation(
    () => new Promise((r) => setTimeout(() => r(page([{ id: 'u1', short_name: 'dona' }])), 30)),
  );
  catalogApi.createProduct.mockReset();
  catalogApi.updateProduct.mockReset();
});

describe('ProductForm', () => {
  it('ma’lumotnomalar kechiksa ham mahsulotning birligi va brendi tanlangan holda ochiladi', async () => {
    renderForm(PRODUCT);

    expect(await screen.findByLabelText("O'lchov birligi *")).toHaveValue('u1');
    expect(screen.getByLabelText('Brend')).toHaveValue('b1');
  });

  it('majburiy maydon bo‘sh bo‘lsa ko‘rinadigan xato chiqadi va so‘rov yuborilmaydi', async () => {
    renderForm(null);

    fireEvent.click(await screen.findByRole('button', { name: 'Saqlash' }));

    expect(await screen.findByText("O'lchov birligini tanlang")).toBeInTheDocument();
    expect(screen.getByText('Kategoriyani tanlang')).toBeInTheDocument();
    expect(catalogApi.createProduct).not.toHaveBeenCalled();
  });

  it('server min_price xatosini "Minimal narx" maydoni ostida bir marta ko‘rsatadi', async () => {
    const msg = "Minimal narx chakana narxdan katta bo'lmasligi kerak.";
    catalogApi.updateProduct.mockRejectedValue(serverFieldError('min_price', msg));
    renderForm(PRODUCT);

    fireEvent.click(await screen.findByRole('button', { name: 'Saqlash' }));

    expect(await screen.findByText(msg)).toBeInTheDocument();
    expect(screen.queryByText(/min_price/)).not.toBeInTheDocument();
  });
});
