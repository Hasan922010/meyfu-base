import { listPage, postAction, retrieve, type QueryParams } from '@/shared/api/crud';
import type { components } from '@/shared/types/api.gen';
import type { ClientDebtSummary, Debt } from '@/shared/types/sales';

export type DebtPaymentItem = components['schemas']['DebtPayment'] & {
  collected_by_name?: string;
};

export const debtsApi = {
  list: (params?: QueryParams) => listPage<Debt>('/debts/', params),
  byClient: (params?: QueryParams) =>
    listPage<ClientDebtSummary>('/debts/by-client/', params),
  myRoute: () => retrieve<Debt[]>('/debts/my/'),
  listPayments: (params?: QueryParams) =>
    listPage<DebtPaymentItem>('/debt-payments/', params),
  cancelPayment: (id: string, reason?: string) =>
    postAction<DebtPaymentItem>(
      `/debt-payments/${id}/cancel/`,
      reason ? { reason } : {},
    ),
};
