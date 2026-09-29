import { create, patch, remove, retrieve } from '@/shared/api/crud';

/** Filialga xos narx (v5: A7) — yo'q bo'lsa mahsulotning umumiy narxi amal qiladi. */
export interface BranchPrice {
  id: string;
  branch: string;
  branch_name: string;
  product: string;
  product_name: string;
  product_sku: string;
  wholesale_price: string;
  retail_price: string;
  min_price: string;
  base_wholesale_price: string;
  updated_at: string;
}

export interface BranchPriceInput {
  branch: string;
  product: string;
  wholesale_price: string;
  retail_price: string;
  min_price: string;
}

export const branchPricesApi = {
  list: (branch: string) => retrieve<BranchPrice[]>(`/branch-prices/?branch=${branch}`),
  create: (body: BranchPriceInput) =>
    create<BranchPrice, BranchPriceInput>('/branch-prices/', body),
  update: (id: string, body: Partial<BranchPriceInput>) =>
    patch<BranchPrice, BranchPriceInput>(`/branch-prices/${id}/`, body),
  remove: (id: string) => remove(`/branch-prices/${id}/`),
};
