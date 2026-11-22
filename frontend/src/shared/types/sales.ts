import type { components } from '@/shared/types/api.gen';

// Audit API-001: bu tiplar avval qo'lda yozilgan va serializer bilan mos emas edi
// (`discount_percent`, `order`, `latitude` va h.k. yetishmasdi). Endi OpenAPI
// sxemasidan olinadi — `npm run gen:api` bilan yangilanadi.

type Schemas = components['schemas'];

export type PaymentType = Schemas['PaymentTypeEnum'];
export type SaleStatus = Schemas['SaleStatusEnum'];
export type SaleItem = Schemas['SaleItem'];

// `order_number` / `sale_number` — serializer'da `default=None` (buyurtma/sotuv
// bo'lmasa `null`), lekin drf-spectacular buni nullable deb belgilamaydi.
export type Sale = Omit<Schemas['Sale'], 'order_number'> & {
  readonly order_number: string | null;
};

export type Debt = Omit<Schemas['Debt'], 'sale_number'> & {
  readonly sale_number: string | null;
};

export interface ClientDebtSummary {
  client: string;
  client_name: string;
  client_phone: string;
  debt_count: number;
  amount: string;
  paid_amount: string;
  remaining: string;
  due_date: string | null;
  status: string;
  status_display: string;
  primary_debt_id: string | null;
}

export type SaleReturn = Schemas['SaleReturn'] & { distributor_name?: string };
