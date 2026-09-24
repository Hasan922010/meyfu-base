import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';

import { extractApiError, extractFieldErrors } from '@/shared/api/client';

function apiError(data: unknown, status = 400): AxiosError {
  const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST');
  err.response = { data, status, statusText: '', headers: {}, config: {} } as AxiosResponse;
  return err;
}

const drfValidation = apiError({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: "So'rovda xatolik bor.",
    details: {
      phone: ['Bu telefon raqami band.'],
      distributor_profile: { base_salary: ['Musbat son kiriting.'] },
      non_field_errors: ['Umumiy xato.'],
    },
  },
});

const insufficientStock = apiError(
  {
    success: false,
    error: {
      code: 'INSUFFICIENT_STOCK',
      message: '«Bio kukun 3kg» — omborda 1320 dona bo‘sh, 5000 so‘ralgan',
      details: { available: '1320.000', requested: '5000.000' },
    },
  },
  409,
);

describe('biznes xatosi (audit K5)', () => {
  it('texnik details emas, serverning o‘zbekcha xabarini ko‘rsatadi', () => {
    expect(extractApiError(insufficientStock)).toBe(
      '«Bio kukun 3kg» — omborda 1320 dona bo‘sh, 5000 so‘ralgan',
    );
  });

  it('biznes details formaga maydon xatosi sifatida bog‘lanmaydi', () => {
    expect(extractFieldErrors(insufficientStock)).toEqual({});
  });
});

describe('extractFieldErrors (UX-001)', () => {
  it('DRF maydon xatolarini tekis yo‘lga keltiradi', () => {
    expect(extractFieldErrors(drfValidation)).toEqual({
      phone: 'Bu telefon raqami band.',
      'distributor_profile.base_salary': 'Musbat son kiriting.',
      non_field_errors: 'Umumiy xato.',
    });
  });

  it('maydon xatosi bo‘lmaganda bo‘sh obyekt', () => {
    expect(
      extractFieldErrors(apiError({ success: false, error: { message: 'x', details: {} } })),
    ).toEqual({});
    expect(extractFieldErrors(new Error('oddiy'))).toEqual({});
  });
});

describe('extractApiError (UX-001)', () => {
  it('ichki maydon nomlari o‘rniga o‘zbekcha nom chiqadi (audit m1)', () => {
    const err = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, null, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        success: false,
        error: {
          code: 'INVALID',
          message: "So'rovda xatolik bor.",
          details: {
            debt_limit: ['Raqam kiritilishi kerak.'],
            invoice_number: ['Bu yetkazib beruvchida shunday nakladnoy bor.'],
          },
        },
      },
    });

    const msg = extractApiError(err);

    expect(msg).toContain('Qarz limiti: Raqam kiritilishi kerak.');
    expect(msg).toContain('Nakladnoy raqami: Bu yetkazib beruvchida shunday nakladnoy bor.');
    expect(msg).not.toMatch(/debt_limit|invoice_number/);
  });

  it('maydon xatolarini o‘qiladigan matnga aylantiradi (umumiy toast emas)', () => {
    const msg = extractApiError(drfValidation);
    expect(msg).toContain('Telefon: Bu telefon raqami band.');
    expect(msg).toContain('Asosiy maosh: Musbat son kiriting.');
    expect(msg).toContain('Umumiy xato.');
    expect(msg).not.toBe("So'rovda xatolik bor.");
  });

  it('{detail: ...} bo‘lsa o‘sha matnni qaytaradi', () => {
    const msg = extractApiError(
      apiError({ success: false, error: { code: 'X', message: 'Parol noto‘g‘ri.', details: {} } }),
    );
    expect(msg).toBe('Parol noto‘g‘ri.');
  });

  it('javob umuman kelmasa — ulanish xatosi', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(extractApiError(err)).toMatch(/ulanib bo'lmadi/i);
  });
});
