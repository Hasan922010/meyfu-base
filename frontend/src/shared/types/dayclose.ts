export type DayCloseStatus = 'OPEN' | 'PENDING' | 'CLOSED';

export interface DailyReturnItem {
  id: string;
  product: string;
  product_name: string;
  quantity: string;
  condition: 'GOOD' | 'DAMAGED' | 'EXPIRED';
  price: string;
  amount: string;
}

export interface DailyReturn {
  id: string;
  number: string;
  date: string;
  total_amount: string;
  items: DailyReturnItem[];
}

export interface DayClose {
  id: string;
  date: string;
  distributor: string;
  distributor_name: string;
  status: DayCloseStatus;
  status_display: string;
  loaded_amount: string;
  sold_amount: string;
  returned_amount: string;
  stock_difference_qty: string;
  stock_difference_amount: string;
  cash_sales_amount: string;
  debt_collected_amount: string;
  cash_expected: string;
  cash_handed_amount: string;
  cash_difference: string;
  debt_given_amount: string;
  sales_count: number;
  visits_count: number;
  new_clients_count: number;
  has_difference: boolean;
  closed_by: string | null;
  closed_at: string | null;
  note: string;
  daily_returns: DailyReturn[];
  created_at: string;
}

export interface DayCloseToday {
  submitted: boolean;
  day_close?: DayClose;
  date?: string;
  loaded_amount?: string;
  sold_amount?: string;
  cash_sales_amount?: string;
  debt_collected_amount?: string;
  debt_given_amount?: string;
  cash_expected?: string;
  sales_count?: number;
  visits_count?: number;
  van_items?: Array<{
    product: string;
    product_name: string;
    product_sku: string;
    unit: string;
    quantity: string;
    wholesale_price: string;
  }>;
}

export interface DashboardData {
  date: string;
  kpi: {
    sales_total: string;
    profit: string;
    cash_in: string;
    debt_given: string;
    debt_collected: string;
    sales_count: number;
    active_distributors: number;
    outstanding_debt: string;
    flagged_sales: number;
    visits: number;
  };
  top_products: Array<{ name: string; quantity: string; amount: string }>;
  by_distributor: Array<{ name: string; amount: string; count: number }>;
  recent_sales: Array<{
    number: string;
    client: string;
    distributor: string;
    amount: string;
    payment_type: string;
    flagged: boolean;
    status: string;
  }>;
}
