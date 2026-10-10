export interface Warehouse {
  id: string;
  name: string;
  address: string;
  phone?: string;
  is_active: boolean;
  /** Filial — asosiy ombordan tovar oladigan alohida ombor */
  is_branch?: boolean;
  manager?: string | null;
  manager_name?: string | null;
  is_opening_locked?: boolean;
  opening_confirmed_at?: string | null;
  opening_confirmed_by?: string | null;
  opening_confirmed_by_name?: string | null;
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
  /** Faqat boshlang'ich qoldiq uchun — xaridlar avtomatik qo'shilmaydi. */
  balance: string;
  created_at: string;
}

export interface SupplierTransaction {
  id: string;
  date: string;
  transaction_type: 'OPENING_BALANCE' | 'CORRECTION';
  amount: string;
  balance_after: string;
  note: string;
  created_at: string;
}

export interface StockMovement {
  id: string;
  movement_type: string;
  movement_type_display: string;
  warehouse: string;
  product: string;
  product_sku: string;
  quantity: string;
  balance_after: string;
  from_location: string;
  to_location: string;
  reference_type: string;
  reference_id: string;
  user: string | null;
  note: string;
  created_at: string;
}

export interface Stock {
  id: string;
  warehouse: string;
  warehouse_name: string;
  product: string;
  product_name: string;
  product_sku: string;
  product_unit: string;
  /** Mahsulotning "kam qoldiq" chegarasi (0 — belgilanmagan) */
  min_stock_alert: string;
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

export type InventoryStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface InventoryCountItem {
  id: string;
  product: string;
  product_name: string;
  product_sku: string;
  product_unit: string;
  /** To'ldirilgan paytdagi hisob qoldig'i */
  expected_qty: string;
  /** `null` — hali sanalmagan */
  actual_qty: string | null;
  difference: string | null;
  cost_price: string;
  note: string;
}

export interface InventoryCount {
  id: string;
  number: string;
  warehouse: string;
  warehouse_name: string;
  date: string;
  status: InventoryStatus;
  status_display: string;
  note: string;
  confirmed_at: string | null;
  created_at: string;
  items_count: number;
  counted_count: number;
  /** Sanalgan qatorlar farqi × tannarx (so'm, ishorali) */
  difference_amount: string;
  /** Faqat bitta hujjat so'ralganda keladi */
  items?: InventoryCountItem[];
}

export interface InventoryItemInput {
  id: string;
  actual_qty: string | null;
  note?: string;
}

export type TransferStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';

export interface TransferItem {
  id: string;
  product: string;
  product_name: string;
  product_sku: string;
  product_unit: string;
  quantity: string;
  /** `null` — hali qabul qilinmagan */
  received_quantity: string | null;
  difference: string | null;
  cost_price: string;
}

export interface Transfer {
  id: string;
  number: string;
  from_warehouse: string;
  from_warehouse_name: string;
  to_warehouse: string;
  to_warehouse_name: string;
  date: string;
  status: TransferStatus;
  status_display: string;
  note: string;
  receive_note: string;
  sent_at: string | null;
  sent_by_name: string | null;
  received_at: string | null;
  received_by_name: string | null;
  items: TransferItem[];
  created_at: string;
}

export interface TransferInput {
  from_warehouse: string;
  to_warehouse: string;
  date: string;
  note?: string;
  items: Array<{ product: string; quantity: string }>;
}
