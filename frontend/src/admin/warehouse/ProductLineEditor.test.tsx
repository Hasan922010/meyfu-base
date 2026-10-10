import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Product } from '@/shared/types/catalog';
import { ProductLineEditor } from './ProductLineEditor';

const mockProducts: Product[] = [
  {
    id: 'p1',
    name: "Qo'l sovuni 100g",
    sku: 'SOAP-100',
    barcode: '880011',
    category: 'c1',
    category_name: 'Sovunlar',
    brand: 'b1',
    brand_name: 'Meyfu',
    unit: 'u1',
    unit_name: 'dona',
    cost_price: '5000',
    wholesale_price: '6000',
    retail_price: '7000',
    min_price: '5500',
    pack_quantity: '1',
    commission_percent: '0',
    min_stock_alert: '10',
    is_active: true,
    image: null,
    images: [],
    image_thumb: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'p2',
    name: 'Bio kukun 3kg',
    sku: 'BIO-3KG',
    barcode: '880022',
    category: 'c2',
    category_name: 'Kukunlar',
    brand: null,
    brand_name: null,
    unit: 'u1',
    unit_name: 'dona',
    cost_price: '22000',
    wholesale_price: '26000',
    retail_price: '30000',
    min_price: '25000',
    pack_quantity: '1',
    commission_percent: '0',
    min_stock_alert: '20',
    is_active: true,
    image: null,
    images: [],
    image_thumb: null,
    created_at: '',
    updated_at: '',
  },
];

describe('ProductLineEditor', () => {
  it('filters products by name, sku, category and adds to table', () => {
    const onChange = vi.fn();
    render(
      <ProductLineEditor
        products={mockProducts}
        value={[]}
        onChange={onChange}
        priceSource="wholesale_price"
        priceLabel="Optom narx"
      />,
    );

    const input = screen.getByPlaceholderText(/Mahsulot qidirish/);

    // Search by category name
    fireEvent.change(input, { target: { value: 'Sovunlar' } });
    expect(screen.getByText("Qo'l sovuni 100g")).toBeInTheDocument();
    expect(screen.queryByText('Bio kukun 3kg')).not.toBeInTheDocument();

    // Click to add
    fireEvent.click(screen.getByText("Qo'l sovuni 100g"));
    expect(onChange).toHaveBeenCalledWith([
      { product: 'p1', quantity: '1', price: '6000' },
    ]);
  });

  it('matches products with apostrophe variations', () => {
    const onChange = vi.fn();
    render(
      <ProductLineEditor
        products={mockProducts}
        value={[]}
        onChange={onChange}
        priceSource="wholesale_price"
        priceLabel="Optom narx"
      />,
    );

    const input = screen.getByPlaceholderText(/Mahsulot qidirish/);
    // User types with right curly apostrophe ’
    fireEvent.change(input, { target: { value: 'Qo’l' } });
    expect(screen.getByText("Qo'l sovuni 100g")).toBeInTheDocument();
  });

  it('shows "Mahsulot topilmadi" feedback when no results match', () => {
    render(
      <ProductLineEditor
        products={mockProducts}
        value={[]}
        onChange={vi.fn()}
        priceSource="wholesale_price"
        priceLabel="Optom narx"
      />,
    );

    const input = screen.getByPlaceholderText(/Mahsulot qidirish/);
    fireEvent.change(input, { target: { value: 'nomavjud_tovar' } });
    expect(screen.getByText('Mahsulot topilmadi')).toBeInTheDocument();
  });
});
