import { api } from '@/shared/api/client';
import { listPage, postAction, retrieve, type QueryParams } from '@/shared/api/crud';
import type { ApiSuccess } from '@/shared/types/api';
import type { DashboardData, DayClose, DayCloseToday } from '@/shared/types/dayclose';
import type { Debt, Sale } from '@/shared/types/sales';

interface SalesSummary {
  group_by: string;
  date_from: string;
  date_to: string;
  rows: Array<Record<string, string | number>>;
}

export const reportsApi = {
  dashboard: () => retrieve<DashboardData>('/reports/dashboard/'),
  salesSummary: (params?: QueryParams) =>
    retrieve<SalesSummary>(`/reports/sales-summary/${toQuery(params)}`),
  exportBlob: async (params?: QueryParams): Promise<Blob> => {
    const resp = await api.get(`/reports/export/${toQuery(params)}`, {
      responseType: 'blob',
    });
    return resp.data as Blob;
  },
};

export const salesApi = {
  list: (params?: QueryParams) => listPage<Sale>('/sales/', params),
  cancel: (id: string, reason: string) =>
    postAction<Sale>(`/sales/${id}/cancel/`, { reason }),
  resolve: (id: string, accept: boolean) =>
    postAction<Sale>(`/sales/${id}/resolve/`, { accept }),
  debts: (params?: QueryParams) => listPage<Debt>('/debts/', params),
};

export const dayCloseApi = {
  list: (params?: QueryParams) => listPage<DayClose>('/day-close/', params),
  myToday: () => retrieve<DayCloseToday>('/day-close/my-today/'),
  confirm: (id: string) => postAction<DayClose>(`/day-close/${id}/confirm/`),
  submit: (body: {
    warehouse: string;
    cash_handed: string;
    items: Array<{ product: string; quantity: string; condition: string }>;
    note?: string;
  }) => {
    return api
      .post<ApiSuccess<DayClose>>('/day-close/submit/', body)
      .then((r) => r.data.data);
  },
};

function toQuery(params?: QueryParams): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`;
}
