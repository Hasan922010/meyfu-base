import { listPage, retrieve, type QueryParams } from '@/shared/api/crud';
import type { Debt } from '@/shared/types/sales';

export const debtsApi = {
  list: (params?: QueryParams) => listPage<Debt>('/debts/', params),
  myRoute: () => retrieve<Debt[]>('/debts/my/'),
};
