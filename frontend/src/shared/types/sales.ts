export type PaymentType = 'NAQD' | 'PLASTIK' | 'OTKAZMA' | 'QARZ' | 'ARALASH';
export type SaleStatus = 'COMPLETED' | 'FLAGGED' | 'CONFLICT' | 'CANCELLED';

export interface SaleItem {
  id: string;
  product: string;
  product_name: string;
  product_sku: string;
  quantity: string;
  price: string;
  cost_price: string;
  amount: string;
  profit: string;
  below_min_price: boolean;
}

export interface Sale {
  id: string;
  number: string;
  date: string;
  distributor: string;
  distributor_name: string;
  client: string;
  client_name: string;
  payment_type: PaymentType;
  payment_type_display: string;
  total_amount: string;
  discount_amount: string;
  paid_amount: string;
  debt_amount: string;
  due_date: string | null;
  status: SaleStatus;
  status_display: string;
  flagged: boolean;
  flag_reason: string;
  note: string;
  items: SaleItem[];
  created_at: string;
}

export interface Debt {
  id: string;
  client: string;
  client_name: string;
  sale: string | null;
  sale_number: string | null;
  amount: string;
  paid_amount: string;
  remaining: string;
  due_date: string | null;
  status: 'ACTIVE' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  status_display: string;
  created_at: string;
}
