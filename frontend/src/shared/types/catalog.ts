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
  commission_percent: string;
  min_stock_alert: string;
  is_active: boolean;
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
  commission_percent?: string;
  min_stock_alert?: string;
  is_active?: boolean;
}
