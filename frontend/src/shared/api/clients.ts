import {
  create,
  listPage,
  patch,
  postAction,
  remove,
  retrieve,
  type QueryParams,
} from '@/shared/api/crud';
import type {
  Client,
  ClientInput,
  ClientVisit,
  ClientVisitInput,
  Route,
  RouteInput,
} from '@/shared/types/clients';
import type { Debt } from '@/shared/types/sales';

interface ClientHistory {
  visits: ClientVisit[];
}

export const clientsApi = {
  list: (params?: QueryParams) => listPage<Client>('/clients/', params),
  create: (body: ClientInput) => create<Client, ClientInput>('/clients/', body),
  update: (id: string, body: Partial<ClientInput>) =>
    patch<Client, ClientInput>(`/clients/${id}/`, body),
  remove: (id: string) => remove(`/clients/${id}/`),
  history: (id: string) => retrieve<ClientHistory>(`/clients/${id}/history/`),
  /** Mijoz boshlang'ich qarzi — sotuvsiz. */
  openingBalance: (body: { client: string; amount: string; note?: string }) =>
    postAction<Debt>('/clients/opening-balance/', body),

  routes: (params?: QueryParams) => listPage<Route>('/routes/', params),
  myRoutes: () => retrieve<Route[]>('/routes/my/'),
  createRoute: (body: RouteInput) => create<Route, RouteInput>('/routes/', body),
  updateRoute: (id: string, body: Partial<RouteInput>) =>
    patch<Route, RouteInput>(`/routes/${id}/`, body),

  visits: (params?: QueryParams) => listPage<ClientVisit>('/client-visits/', params),
  checkIn: (body: ClientVisitInput) =>
    create<ClientVisit, ClientVisitInput>('/client-visits/', body),
};
