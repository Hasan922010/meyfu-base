import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CachedVanStock } from '@/offline/db';

import type { CartLine } from './lib/cart';
import { SaleProductList } from './SaleProductList';

const VAN: CachedVanStock[] = [
  { product: 'gel', product_name: 'Yuvish geli 1L', product_sku: 'GEL-1L', unit: 'dona', quantity: 40 },
  { product: 'bio', product_name: 'Bio kukun 3kg', product_sku: 'BIO-3KG', unit: 'dona', quantity: 42 },
];
const PRICES: Record<string, number> = { gel: 22000, bio: 26000 };

function setup(cart: CartLine[] = []) {
  const onChange = vi.fn();
  render(
    <SaleProductList
      van={VAN}
      cart={cart}
      priceOf={(id) => PRICES[id] ?? 0}
      thumbOf={() => null}
      onChange={onChange}
    />,
  );
  return onChange;
}

const gelLine = (quantity: number, price = 22000): CartLine => ({
  product: 'gel', product_name: 'Yuvish geli 1L', quantity, price, max: 40,
});

describe('SaleProductList (UX M4)', () => {
  it('mashinadagi tovarlar yozmasdan darhol ko‘rinadi', () => {
    setup();

    expect(screen.getByText('Yuvish geli 1L')).toBeInTheDocument();
    expect(screen.getByText('Bio kukun 3kg')).toBeInTheDocument();
  });

  it('qatorga bosish — savatga 1 dona, optom narx bilan', () => {
    const onChange = setup();

    fireEvent.click(screen.getByRole('button', { name: /Yuvish geli 1L — 1 ta qo'shish/ }));

    expect(onChange).toHaveBeenCalledWith([gelLine(1)], '');
  });

  it('miqdorni yozib kiritish mumkin', () => {
    const onChange = setup([gelLine(3)]);

    fireEvent.click(screen.getByRole('button', { name: 'Yuvish geli 1L miqdorini yozish' }));
    const input = screen.getByRole('spinbutton', { name: 'Yuvish geli 1L miqdori' });
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith([gelLine(25)], '');
  });

  it('qoldiqdan ko‘p yozilsa qoldiqqacha kesiladi va xabar beriladi', () => {
    const onChange = setup([gelLine(3)]);

    fireEvent.click(screen.getByRole('button', { name: 'Yuvish geli 1L miqdorini yozish' }));
    const input = screen.getByRole('spinbutton', { name: 'Yuvish geli 1L miqdori' });
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith([gelLine(40)], 'Mashinada faqat 40 dona bor');
  });

  it('narxga bosib o‘zgartirish mumkin', () => {
    const onChange = setup([gelLine(3)]);

    fireEvent.click(screen.getByRole('button', { name: 'Yuvish geli 1L narxini o‘zgartirish' }));
    const input = screen.getByRole('spinbutton', { name: 'Yuvish geli 1L narxi' });
    fireEvent.change(input, { target: { value: '21000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith([gelLine(3, 21000)], '');
  });

  it('qidiruv ro‘yxatni filtrlaydi', () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText('Tovar qidirish…'), { target: { value: 'bio' } });

    expect(screen.queryByText('Yuvish geli 1L')).not.toBeInTheDocument();
    expect(screen.getByText('Bio kukun 3kg')).toBeInTheDocument();
  });
});
