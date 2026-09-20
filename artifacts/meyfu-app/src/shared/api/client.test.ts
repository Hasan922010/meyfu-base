import { AxiosError, type AxiosResponse } from 'axios';
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
  it('maydon xatolarini o‘qiladigan matnga aylantiradi (umumiy toast emas)', () => {
    const msg = extractApiError(drfValidation);
    expect(msg).toContain('Telefon: Bu telefon raqami band.');
    expect(msg).toContain('base_salary: Musbat son kiriting.');
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
