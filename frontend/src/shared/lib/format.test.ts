import { describe, expect, it } from 'vitest';

import {
  amountDigits,
  dateShort,
  groupThousands,
  money,
  numberToWordsUz,
  qty,
} from './format';

describe('groupThousands', () => {
  it('3 xonadan bo‘sh joy bilan ajratadi', () => {
    expect(groupThousands('1250000')).toBe('1 250 000');
    expect(groupThousands('999')).toBe('999');
    expect(groupThousands('1000')).toBe('1 000');
  });
});

describe('money', () => {
  it('butun songacha yaxlitlaydi va "so‘m" qo‘shadi', () => {
    expect(money(1250000)).toBe("1 250 000 so'm");
    expect(money('12500.49')).toBe("12 500 so'm");
    expect(money('12500.5')).toBe("12 501 so'm");
  });

  it('manfiy summada minus belgisi', () => {
    expect(money(-15000)).toBe("−15 000 so'm");
  });

  it('yarim yuqoriga yaxlitlaydi (backend money_round bilan bir yo‘nalish, CALC-001)', () => {
    // backend: SaleItem.amount = "31876.28" → foydalanuvchiga butun so‘m
    expect(money('31876.28')).toBe("31 876 so'm");
    expect(money('0.5')).toBe("1 so'm");
    expect(money('2.5')).toBe("3 so'm");
  });

  it('NaN da xom qiymatni qaytaradi', () => {
    expect(money('abc')).toBe('abc');
  });

  it('nol', () => {
    expect(money(0)).toBe("0 so'm");
  });
});

describe('qty', () => {
  it('kasr qismni saqlaydi, ortiqcha nollarni oladi', () => {
    expect(qty(3)).toBe('3');
    expect(qty(2.5)).toBe('2.5');
    expect(qty('12.500')).toBe('12.5');
    expect(qty(1000.25)).toBe('1 000.25');
  });
});

describe('numberToWordsUz', () => {
  it('asosiy holatlar', () => {
    expect(numberToWordsUz(0)).toBe('nol');
    expect(numberToWordsUz(1)).toBe('bir');
    expect(numberToWordsUz(1000)).toBe('ming');
    expect(numberToWordsUz(1250000)).toBe('bir million ikki yuz ellik ming');
  });

  it('manfiy', () => {
    expect(numberToWordsUz(-5)).toBe('minus besh');
  });
});

describe('dateShort', () => {
  it('ISO sanani dd.MM.yyyy ko‘rinishiga keltiradi', () => {
    expect(dateShort('2026-09-09T10:00:00Z')).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it('noto‘g‘ri sanada xom qiymat', () => {
    expect(dateShort('salom')).toBe('salom');
  });
});

describe('amountDigits', () => {
  it('serverdan kelgan decimal summaning kasr qismini tashlaydi (x100 bo‘lib ketmaydi)', () => {
    expect(amountDigits('30000.00')).toBe('30000');
    expect(amountDigits('2500000.50')).toBe('2500000');
  });

  it('foydalanuvchi yozgan guruhlangan raqamdan faqat raqamlarni qoldiradi', () => {
    expect(amountDigits('1 250 000')).toBe('1250000');
    expect(amountDigits('-150000')).toBe('150000');
    expect(amountDigits('')).toBe('');
  });
});
