import { describe, expect, it } from 'vitest';
import type { CachedProduct } from '@/offline/db';
import { computePromotionalBonuses } from './bonusCalculator';

describe('computePromotionalBonuses', () => {
  const pMain: CachedProduct = {
    id: 'p1',
    name: 'Bio Kukun 3kg',
    sku: 'BIO-3KG',
    barcode: '111',
    unit: 'dona',
    retail_price: '30000',
    wholesale_price: '25000',
    min_price: '20000',
    has_bonus: true,
    bonus_trigger_qty: 10,
    bonus_reward_qty: 1,
    bonus_product: 'p2',
    bonus_product_name: 'Sovun 100g',
    is_active: true,
    image_thumb: null,
  };

  const pBonus: CachedProduct = {
    id: 'p2',
    name: 'Sovun 100g',
    sku: 'SOV-100',
    barcode: '222',
    unit: 'dona',
    retail_price: '7000',
    wholesale_price: '5000',
    min_price: '4000',
    has_bonus: false,
    is_active: true,
    image_thumb: null,
  };

  const pSelfBonus: CachedProduct = {
    id: 'p3',
    name: 'Yuvish geli 1L',
    sku: 'GEL-1L',
    barcode: '333',
    unit: 'dona',
    retail_price: '25000',
    wholesale_price: '20000',
    min_price: '18000',
    has_bonus: true,
    bonus_trigger_qty: 5,
    bonus_reward_qty: 1,
    bonus_product: null, // o'zidan
    is_active: true,
    image_thumb: null,
  };

  const productMap = new Map<string, CachedProduct>([
    ['p1', pMain],
    ['p2', pBonus],
    ['p3', pSelfBonus],
  ]);

  it('xarid miqdori minimal triggerga yetmasa bonus berilmaydi', () => {
    const lines = [{ product: 'p1', quantity: 9 }];
    const bonuses = computePromotionalBonuses(lines, productMap);
    expect(bonuses).toHaveLength(0);
  });

  it('xarid 10 ta bo‘lganda 1 ta bonus tovar beriladi', () => {
    const lines = [{ product: 'p1', quantity: 10 }];
    const bonuses = computePromotionalBonuses(lines, productMap);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]).toEqual({
      bonusProductId: 'p2',
      bonusProductName: 'Sovun 100g',
      bonusQty: 1,
      triggeredByProductName: 'Bio Kukun 3kg',
    });
  });

  it('xarid 25 ta bo‘lganda karrali 2 ta bonus beriladi', () => {
    const lines = [{ product: 'p1', quantity: 25 }];
    const bonuses = computePromotionalBonuses(lines, productMap);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]?.bonusQty).toBe(2);
  });

  it('bonus_product ko‘rsatilmagan bo‘lsa o‘zidan bonus beriladi', () => {
    const lines = [{ product: 'p3', quantity: 12 }];
    const bonuses = computePromotionalBonuses(lines, productMap);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]?.bonusProductId).toBe('p3');
    expect(bonuses[0]?.bonusQty).toBe(2); // 12 / 5 = 2 ta
  });
});
