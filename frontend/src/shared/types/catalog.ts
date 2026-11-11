export interface Category {
  id: string;
  name: string;
  parent: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Unit {
  id: string;
  name: string;
  short_name: string;
  created_at: string;
}

export interface ProductImage {
  id: string;
  image: string;
  thumbnail: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  category_name: string;
  brand: string | null;
  brand_name: string | null;
  unit: string;
  unit_name: string;
  image: string | null;
  images: ProductImage[];
  image_thumb: string | null;
  cost_price: string;
  wholesale_price: string;
  retail_price: string;
  min_price: string;
  pack_quantity: string;
  package_type: string;
  order_commission_rate: string;
  delivery_commission_rate: string;
  has_bonus: boolean;
  bonus_trigger_qty: string;
  bonus_reward_qty: string;
  bonus_product: string | null;
  bonus_product_name: string | null;
  track_variance: boolean;
  commission_percent: string;
  min_stock_alert: string;
  is_active: boolean;
  total_stock?: string | number;
  reserved_stock?: string | number;
  available_stock?: string | number;
  stock_status?: 'out' | 'low' | 'ok';
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  brand?: string | null;
  unit: string;
  cost_price?: string;
  wholesale_price?: string;
  retail_price?: string;
  min_price?: string;
  pack_quantity?: string;
  package_type?: string;
  order_commission_rate?: string;
  delivery_commission_rate?: string;
  has_bonus?: boolean;
  bonus_trigger_qty?: string;
  bonus_reward_qty?: string;
  bonus_product?: string | null;
  track_variance?: boolean;
  commission_percent?: string;
  min_stock_alert?: string;
  is_active?: boolean;
  /** Faqat yaratishda: boshlang'ich qoldiq (CLAUDE.md 6 — Ombor) */
  initial_stock_warehouse?: string;
  initial_stock_quantity?: string;
}
