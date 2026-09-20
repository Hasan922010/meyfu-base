export type PaymentSource = 'CASH_ON_HAND' | 'OWN_MONEY' | 'COMPANY_CARD';
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type WalletTxType =
  | 'SALE_CASH'
  | 'DEBT_COLLECTED'
  | 'EXPENSE'
  | 'HANDOVER'
  | 'ADVANCE'
  | 'CORRECTION';

export interface Wallet {
  id: string;
  distributor: string;
  distributor_name: string;
  balance: string;
  live_balance: string;
  pending_expense_amount: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  date: string;
  transaction_type: WalletTxType;
  type_display: string;
  amount: string;
  balance_after: string;
  reference_type: string;
  note: string;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  requires_receipt: boolean;
  daily_limit: string;
  paid_by: 'COMPANY' | 'DISTRIBUTOR';
  is_active: boolean;
}

export interface Expense {
  id: string;
  distributor: string;
  distributor_name: string;
  date: string;
  category: string;
  category_name: string;
  category_icon: string;
  amount: string;
  description: string;
  receipt_image: string | null;
  payment_source: PaymentSource;
  payment_source_display: string;
  status: ExpenseStatus;
  status_display: string;
  approved_by: string | null;
  approved_at: string | null;
  reject_reason: string;
  is_deductible: boolean;
  fuel_log: {
    liters: string;
    price_per_liter: string;
    odometer: number | null;
    station_name: string;
  } | null;
  created_at: string;
}
