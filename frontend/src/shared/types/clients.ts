export type ClientType =
  | 'SHOP'
  | 'MARKET'
  | 'SUPERMARKET'
  | 'PHARMACY'
  | 'OTHER';

export type VisitResult = 'SOTUV' | 'SOTUVSIZ' | 'YOPIQ';

export interface Route {
  id: string;
  name: string;
  distributor: string | null;
  distributor_name: string | null;
  days_of_week: number[];
  days_display: string[];
  is_active: boolean;
  clients_count: number;
  created_at: string;
}

export interface RouteInput {
  name: string;
  distributor?: string | null;
  days_of_week: number[];
  is_active?: boolean;
}

export interface Client {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  phone2: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  route: string | null;
  route_name: string | null;
  client_type: ClientType;
  client_type_display: string;
  debt_limit: string;
  current_debt: string;
  debt_available: string;
  inn: string;
  photo: string | null;
  is_blocked: boolean;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface ClientInput {
  name: string;
  owner_name?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  latitude?: string | null;
  longitude?: string | null;
  route?: string | null;
  client_type?: ClientType;
  debt_limit?: string;
  inn?: string;
  is_blocked?: boolean;
  note?: string;
}

export interface ClientVisit {
  id: string;
  client: string;
  client_name: string;
  distributor: string;
  checked_in_at: string;
  latitude: string | null;
  longitude: string | null;
  result: VisitResult;
  result_display: string;
  note: string;
  created_at: string;
}

export interface ClientVisitInput {
  client: string;
  result: VisitResult;
  latitude?: string;
  longitude?: string;
  note?: string;
  client_uuid?: string;
}
