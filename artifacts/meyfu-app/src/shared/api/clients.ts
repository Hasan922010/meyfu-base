import { api } from '@/shared/api/client';
import {
  create,
  listPage,
  patch,
  postAction,
  remove,
  retrieve,
  type QueryParams,
} from '@/shared/api/crud';
import type { ApiSuccess } from '@/shared/types/api';
import type {
  Client,
  ClientInput,
  ClientVisit,
  ClientVisitInput,
  Route,
  RouteInput,
} from '@/shared/types/clients';
import type { Debt } from '@/shared/types/sales';

export type ClientOpeningFieldKey =
  | 'name'
  | 'amount'
  | 'assigned_to'
  | 'phone'
  | 'owner_name'
  | 'address'
  | 'route'
  | 'debt_limit'
  | 'note';

export interface ClientOpeningTargetField {
  key: ClientOpeningFieldKey;
  label: string;
  required: boolean;
}

export interface ClientOpeningInspect {
  headers: string[];
  columns: Array<{ index: number; letter: string; header: string }>;
  sample_rows: string[][];
  total_rows: number;
  auto_mapping: Partial<Record<ClientOpeningFieldKey, number>>;
  target_fields: ClientOpeningTargetField[];
}

export interface ClientOpeningImportRow {
  row: number;
  client_name: string;
  assigned_to_name: string;
  current_debt: string;
  target_debt: string;
  delta: string;
  action: 'CREATE_AND_DEBT' | 'CREATE_CLIENT' | 'ADD_DEBT' | 'SKIP' | 'ERROR';
  errors: string[];
}

export interface ClientOpeningImportReport {
  dry_run: boolean;
  created_clients: number;
  existing_clients: number;
  debts_applied: number;
  skipped: number;
  errors: number;
  rows: ClientOpeningImportRow[];
}

export interface StatementRow {
  date: string;
  document: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

/** v5 C2: akt-sverka */
export interface ClientStatement {
  client: { id: string; name: string; phone: string };
  date_from: string;
  date_to: string;
  opening_balance: string;
  debit: string;
  credit: string;
  closing_balance: string;
  rows: StatementRow[];
}

/** v5 C4: marshrut optimallashtirish taklifi */
export interface RouteOptimization {
  route: string;
  km_before: number;
  km_after: number;
  without_location: number;
  clients: Array<{
    id: string;
    name: string;
    address: string;
    order: number;
    latitude: string | null;
    longitude: string | null;
  }>;
}

interface ClientHistory {
  visits: ClientVisit[];
}

export const clientsApi = {
  list: (params?: QueryParams) => listPage<Client>('/clients/', params),
  detail: (id: string) => retrieve<Client>(`/clients/${id}/`),
  create: (body: ClientInput) => create<Client, ClientInput>('/clients/', body),
  update: (id: string, body: Partial<ClientInput>) =>
    patch<Client, ClientInput>(`/clients/${id}/`, body),
  remove: (id: string) => remove(`/clients/${id}/`),
  history: (id: string) => retrieve<ClientHistory>(`/clients/${id}/history/`),
  statement: (id: string, dateFrom: string, dateTo: string) =>
    retrieve<ClientStatement>(
      `/clients/${id}/statement/?date_from=${dateFrom}&date_to=${dateTo}`,
    ),
  statementPdf: async (id: string, dateFrom: string, dateTo: string): Promise<Blob> => {
    const resp = await api.get(`/clients/${id}/statement/`, {
      params: { date_from: dateFrom, date_to: dateTo, fmt: 'pdf' },
      responseType: 'blob',
    });
    return resp.data as Blob;
  },
  /** Mijoz boshlang'ich qarzi — sotuvsiz. */
  openingBalance: (body: { client: string; amount: string; note?: string }) =>
    postAction<Debt>('/clients/opening-balance/', body),
  openingImportTemplate: async (): Promise<Blob> => {
    const resp = await api.get('/clients/opening-import-template/', { responseType: 'blob' });
    return resp.data as Blob;
  },
  openingImportInspect: async (file: File): Promise<ClientOpeningInspect> => {
    const form = new FormData();
    form.append('file', file);
    form.append('mode', 'inspect');
    const { data } = await api.post<ApiSuccess<ClientOpeningInspect>>(
      '/clients/opening-balance/import/',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },
  openingImportApply: async (
    file: File,
    opts: {
      mapping: Partial<Record<ClientOpeningFieldKey, number | null>>;
      default_assigned_to?: string;
      auto_create_missing?: boolean;
      note?: string;
      dry_run: boolean;
    },
  ): Promise<ClientOpeningImportReport> => {
    const form = new FormData();
    form.append('file', file);
    form.append('mapping', JSON.stringify(opts.mapping));
    if (opts.default_assigned_to) form.append('default_assigned_to', opts.default_assigned_to);
    form.append('auto_create_missing', opts.auto_create_missing ?? true ? 'true' : 'false');
    if (opts.note) form.append('note', opts.note);
    form.append('dry_run', opts.dry_run ? 'true' : 'false');
    const { data } = await api.post<ApiSuccess<ClientOpeningImportReport>>(
      '/clients/opening-balance/import/',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  routes: (params?: QueryParams) => listPage<Route>('/routes/', params),
  myRoutes: () => retrieve<Route[]>('/routes/my/'),
  optimizeRoute: (id: string) => retrieve<RouteOptimization>(`/routes/${id}/optimize/`),
  reorderRoute: (id: string, clients: string[]) =>
    postAction<{ route: string; clients: number }>(`/routes/${id}/reorder/`, { clients }),
  createRoute: (body: RouteInput) => create<Route, RouteInput>('/routes/', body),
  updateRoute: (id: string, body: Partial<RouteInput>) =>
    patch<Route, RouteInput>(`/routes/${id}/`, body),

  visits: (params?: QueryParams) => listPage<ClientVisit>('/client-visits/', params),
  checkIn: (body: ClientVisitInput) =>
    create<ClientVisit, ClientVisitInput>('/client-visits/', body),
};
