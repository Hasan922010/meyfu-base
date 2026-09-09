import type { ZodType } from 'zod';

/**
 * API javobining SHAKLINI runtime'da tekshiradi (audit TS-001).
 *
 * TypeScript tiplari runtime'da yo'qoladi — server kutilmagan shakl qaytarsa
 * ilova jimgina buziladi. Bu yordamchi kritik chegaralarda (login, offline sync,
 * katalog yuklab olish) shakl buzilishini aniq xatoga aylantiradi.
 *
 * Sxemalar ataylab "loose" (`.passthrough()`) — faqat kerakli maydonlar
 * tekshiriladi, backend qo'shimcha maydon qo'shsa buzilmaydi.
 */
export class ApiShapeError extends Error {
  constructor(
    readonly context: string,
    readonly issues: unknown,
  ) {
    super(`Serverdan kutilmagan javob (${context}).`);
    this.name = 'ApiShapeError';
  }
}

export function assertApiShape<T>(
  schema: ZodType<T>,
  data: unknown,
  context: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[API shakli xato: ${context}]`, result.error.issues, data);
    throw new ApiShapeError(context, result.error.issues);
  }
  return result.data;
}
