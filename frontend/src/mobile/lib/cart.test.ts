import { describe, expect, it } from 'vitest';

import { addToCart, remainingFor, type CartLine } from './cart';

const gel = { product: 'gel', product_name: 'Yuvish geli 1L', price: 22000 };

function line(quantity: number): CartLine {
  return { ...gel, quantity, max: 40 };
}

describe('addToCart (UX M2, M3)', () => {
  it('yangi mahsulotni qo‘shadi', () => {
    const res = addToCart([], { ...gel, quantity: 5 }, 40);

    expect(res.cart).toEqual([line(5)]);
    expect(res.clampedTo).toBeNull();
  });

  it('savatdagi mahsulotni qayta qo‘shsa miqdorlar jamlanadi (20 + 10 = 30)', () => {
    const res = addToCart([line(20)], { ...gel, quantity: 10 }, 40);

    expect(res.cart).toEqual([line(30)]);
    expect(res.clampedTo).toBeNull();
  });

  it('qoldiqdan oshsa qoldiqqacha kesadi va buni bildiradi', () => {
    const res = addToCart([line(20)], { ...gel, quantity: 21 }, 40);

    expect(res.cart).toEqual([line(40)]);
    expect(res.clampedTo).toBe(40);
  });

  it('boshqa qatorlarning tartibini saqlaydi', () => {
    const soap: CartLine = { product: 'soap', product_name: 'Sovun', price: 5000, quantity: 2, max: 9 };
    const res = addToCart([line(1), soap], { ...gel, quantity: 1 }, 40);

    expect(res.cart.map((l) => l.product)).toEqual(['gel', 'soap']);
  });

  it('oxirgi kiritilgan narxni qo‘llaydi', () => {
    const res = addToCart([line(1)], { ...gel, price: 21000, quantity: 1 }, 40);

    expect(res.cart[0]?.price).toBe(21000);
  });
});

describe('remainingFor', () => {
  it('qoldiqdan savatdagini ayiradi', () => {
    expect(remainingFor(40, [line(20)], 'gel')).toBe(20);
  });

  it('savatda bo‘lmasa butun qoldiq', () => {
    expect(remainingFor(40, [], 'gel')).toBe(40);
  });

  it('manfiy bo‘lmaydi', () => {
    expect(remainingFor(10, [line(20)], 'gel')).toBe(0);
  });
});
