import { create, listPage, postAction, retrieve, type QueryParams } from '@/shared/api/crud';
import type {
  Expense,
  ExpenseCategory,
  Wallet,
  WalletTransaction,
} from '@/shared/types/finance';

export const walletApi = {
  my: () => retrieve<Wallet>('/wallet/my/'),
  myTransactions: () => retrieve<WalletTransaction[]>('/wallet/my/transactions/'),
};

export const expensesApi = {
  categories: () => listPage<ExpenseCategory>('/expense-categories/', { page_size: 100 }),
  list: (params?: QueryParams) => listPage<Expense>('/expenses/', params),
  myToday: () => retrieve<Expense[]>('/expenses/my-today/'),
  summary: () =>
    retrieve<{
      total: string;
      pending_count: number;
      by_category: Array<{ category: string; total: string }>;
    }>('/expenses/summary/'),
  approve: (id: string) => postAction<Expense>(`/expenses/${id}/approve/`),
  reject: (id: string, reason: string) =>
    postAction<Expense>(`/expenses/${id}/reject/`, { reason }),
  create: (body: {
    category: string;
    amount: string;
    payment_source: string;
    description?: string;
    latitude?: string;
    longitude?: string;
  }) => create<Expense, typeof body>('/expenses/', body),
};
