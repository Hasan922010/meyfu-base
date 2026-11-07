/**
 * Select qiymati: foydalanuvchi tanlagan bo'lsa — o'sha; tanlamagan va variant
 * yagona bo'lsa — o'sha variant (bitta ombor/ta'minotchini har safar qo'lda
 * tanlatmaslik uchun, audit p3). Holat emas, render paytida hisoblanadi.
 */
export function withOnlyOption(chosen: string, options: ReadonlyArray<{ id: string }> | undefined): string {
  if (chosen) return chosen;
  return options?.length === 1 ? options[0]!.id : '';
}
