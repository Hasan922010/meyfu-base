import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CachedVanStock } from '@/offline/db';
import { PackagingModal } from './PackagingModal';

const STOCK: CachedVanStock = {
  product: 'p1',
  product_name: 'Toza Gel 1L',
  product_sku: 'GEL-1L',
  unit: 'dona',
  quantity: 48,
};

const PACK_INFO = {
  package_type: 'karopka',
  pack_quantity: 12,
};

describe('PackagingModal', () => {
  it('dona va qadoq rejimini almashtiradi va hisob-kitobni to‘g‘ri chiqaradi', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <PackagingModal
        open={true}
        stock={STOCK}
        packInfo={PACK_INFO}
        defaultPrice={20000}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    // Qadoq ma'lumoti ko'rinishi
    expect(screen.getByText('Toza Gel 1L — miqdor tanlash')).toBeInTheDocument();
    expect(screen.getByText('1 karopka = 12 dona')).toBeInTheDocument();
    expect(screen.getByText(/48 dona/)).toBeInTheDocument();

    // Dastlabki rejim: qadoq (1 karopka = 12 dona * 20 000 = 240 000)
    expect(screen.getByText('1 karopka × 12 dona = 12 dona')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Savatga qo'shish · 240 000/ })).toBeInTheDocument();

    // 2 karopkaga oshirish
    fireEvent.click(screen.getByRole('button', { name: "Ko'paytirish" }));
    expect(screen.getByText('2 karopka × 12 dona = 24 dona')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Savatga qo'shish · 480 000/ })).toBeInTheDocument();

    // Tasdiqlash
    fireEvent.click(screen.getByRole('button', { name: /Savatga qo'shish · 480 000/ }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'p1',
        quantity: 24,
        unit_mode: 'package',
        package_count: 2,
        package_type: 'karopka',
        pack_quantity: 12,
        price: 20000,
      }),
    );
  });

  it('dona rejimiga o‘tganda donalab hisoblaydi', () => {
    const onConfirm = vi.fn();

    render(
      <PackagingModal
        open={true}
        stock={STOCK}
        packInfo={PACK_INFO}
        defaultPrice={20000}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    // Dona tugmasini bosish
    fireEvent.click(screen.getByRole('button', { name: 'Dona (dona)' }));

    // Miqdorni 5 donaga sozlash
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByText(/Jami: 5 dona × 20 000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Savatga qo'shish · 100 000/ }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'p1',
        quantity: 5,
        unit_mode: 'base',
        package_count: undefined,
        price: 20000,
      }),
    );
  });
});

