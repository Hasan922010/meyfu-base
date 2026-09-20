import { create, listPage, patch, remove } from '@/shared/api/crud';

/** Ma'lumotnoma yozuvi — barcha oddiy lug'atlar shu shaklga mos. */
export interface RefRow {
  id: string;
  [k: string]: string | number | boolean | null | undefined;
}

/** Bir endpoint uchun to'liq CRUD to'plami. */
export function refResource<T extends RefRow>(path: string) {
  const base = `/${path}/`;
  return {
    list: () => listPage<T>(base, { page_size: 200, ordering: 'name' }),
    create: (body: Partial<T>) => create<T, Partial<T>>(base, body),
    update: (id: string, body: Partial<T>) =>
      patch<T, Partial<T>>(`${base}${id}/`, body),
    remove: (id: string) => remove(`${base}${id}/`),
  };
}
