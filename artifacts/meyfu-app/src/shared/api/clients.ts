import {
  create,
  listPage,
  patch,
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

interface ClientHistory {
  visits: ClientVisit[];
}

export const clientsApi = {
  list: (params?: QueryParams) => listPage<Client>('/clients/', params),
  create: (body: ClientInput) => create<Client, ClientInput>('/clients/', body),
  update: (id: string, body: Partial<ClientInput>) =>
    patch<Client, ClientInput>(`/clients/${id}/`, body),
  history: (id: string) => retrieve<ClientHistory>(`/clients/${id}/history/`),

  routes: (params?: QueryParams) => listPage<Route>('/routes/', params),
  myRoutes: () => retrieve<Route[]>('/routes/my/'),
  createRoute: (body: RouteInput) => create<Route, RouteInput>('/routes/', body),
  updateRoute: (id: string, body: Partial<RouteInput>) =>
    patch<Route, RouteInput>(`/routes/${id}/`, body),

  visits: (params?: QueryParams) => listPage<ClientVisit>('/client-visits/', params),
  checkIn: (body: ClientVisitInput) =>
    create<ClientVisit, ClientVisitInput>('/client-visits/', body),
};
