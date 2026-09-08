export interface Warehouse {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  inn: string;
  address: string;
  note: string;
  is_active: boolean;
  created_at: string;
}

export interface Stock {
  id: string;
  warehouse: string;
  warehouse_name: string;
  product: string;
  product_name: string;
  product_sku: string;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  updated_at: string;
}

export type PurchaseStatus = 'DRAFT' | 'CONFIRMED';

export interface PurchaseItem {
  id?: string;
  product: string;
  product_name?: string;
  quantity: string;
  cost_price: string;
  amount?: string;
}

export interface Purchase {
  id: string;
  number: string;
  supplier: string;
  supplier_name: string;
  warehouse: string;
  warehouse_name: string;
  invoice_number: string;
  date: string;
  total_amount: string;
  paid_amount: string;
  debt_amount: string;
  source: 'MANUAL' | 'SCAN';
  status: PurchaseStatus;
  status_display: string;
  confirmed_at: string | null;
  note: string;
  items: PurchaseItem[];
  created_at: string;
}

export interface PurchaseInput {
  supplier: string;
  warehouse: string;
  invoice_number?: string;
  date: string;
  paid_amount?: string;
  note?: string;
  items: Array<{ product: string; quantity: string; cost_price: string }>;
}

export type LoadingStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'CLOSED';

export interface LoadingItem {
  id?: string;
  product: string;
  product_name?: string;
  quantity: string;
  price?: string | null;
  amount?: string;
}

export interface Loading {
  id: string;
  number: string;
  date: string;
  distributor: string;
  distributor_name: string;
  warehouse: string;
  warehouse_name: string;
  status: LoadingStatus;
  status_display: string;
  total_amount: string;
  sent_at: string | null;
  confirmed_at: string | null;
  note: string;
  items: LoadingItem[];
  created_at: string;
}

export interface LoadingInput {
  date: string;
  distributor: string;
  warehouse: string;
  note?: string;
  items: Array<{ product: string; quantity: string; price?: string }>;
}

export interface VanStock {
  id: string;
  distributor: string;
  distributor_name: string;
  product: string;
  product_name: string;
  product_sku: string;
  unit: string;
  image: string | null;
  quantity: string;
  updated_at: string;
}
