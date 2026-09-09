import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import { extractFieldErrors } from '@/shared/api/client';

// Audit UX-001: backend (DRF) maydon xatolarini react-hook-form ga bog'lash.

/**
 * `error` dagi maydon xatolarini `setError` orqali formaga bog'laydi.
 * `fieldMap` — serializer maydon nomini (yoki to'liq yo'lni) form maydoniga
 * moslashtiradi (masalan `{ 'distributor_profile.base_salary': 'p_base_salary' }`).
 * Formaga bog'lab bo'lmagan (non_field_errors / noma'lum) xabarlar qaytariladi —
 * ularni umumiy xato blokida ko'rsating.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldMap: Record<string, string> = {},
): string[] {
  const fields = extractFieldErrors(error);
  const leftover: string[] = [];
  for (const [path, message] of Object.entries(fields)) {
    const leaf = path.split('.').pop() ?? path;
    const name = fieldMap[path] ?? fieldMap[leaf] ?? leaf;
    if (name === 'non_field_errors' || name === 'detail' || name === '') {
      leftover.push(message);
    } else {
      setError(name as FieldPath<T>, { type: 'server', message });
    }
  }
  return leftover;
}
