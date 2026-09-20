import {
  listPage,
  postAction,
  retrieve,
  type QueryParams,
} from '@/shared/api/crud';

export type OrderStatus =
  | 'DRAFT'
  | 'PLACED'
  | 'APPROVED'
  | 'LOADED'
  | 'DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'CANCELLED';

export type PaymentIntent = '' | 'NAQD' | 'PLASTIK' | 'OTKAZMA' | 'QARZ' | 'ARALASH';

export interface OrderItem {
  id: string;
  product: string;
  product_name: string;
  product_sku: string;
  quantity: string;
  delivered_quantity: string;
  price: string;
  amount: string;
}

export interface Order {
  id: string;
  number: string;
  date: string;
  client: string;
  client_name: string;
  taken_by: string;
  taken_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  loading: string | null;
  status: OrderStatus;
  status_display: string;
  payment_intent: PaymentIntent;
  desired_date: string | null;
  total_amount: string;
  note: string;
  client_uuid: string | null;
  cancelled_at: string | null;
  cancel_reason: string;
  items: OrderItem[];
  created_at: string;
}

export interface OrderLineInput {
  product: string;
  quantity: string;
  price: string;
}

export interface OrderCreateInput {
  client: string;
  taken_by?: string;
  items: OrderLineInput[];
  date?: string;
  payment_intent?: PaymentIntent;
  desired_date?: string | null;
  note?: string;
  place?: boolean;
  client_uuid?: string;
}

export interface FulfillLineInput {
  item: string;
  delivered_quantity: string;
  price?: string | null;
}

export interface OrderFulfillInput {
  lines: FulfillLineInput[];
  distributor?: string;
  payment_type?: Exclude<PaymentIntent, ''>;
  paid_amount?: string | null;
  due_date?: string | null;
  latitude?: string;
  longitude?: string;
  note?: string;
  client_uuid?: string;
}

export interface BuildLoadingInput {
  distributor: string;
  warehouse: string;
  order_ids: string[];
  date?: string;
}

export const ordersApi = {
  list: (params?: QueryParams) => listPage<Order>('/orders/', params),
  get: (id: string) => retrieve<Order>(`/orders/${id}/`),
  create: (body: OrderCreateInput) => postAction<Order>('/orders/', body),
  place: (id: string) => postAction<Order>(`/orders/${id}/place/`),
  approve: (id: string) => postAction<Order>(`/orders/${id}/approve/`),
  cancel: (id: string, reason?: string) =>
    postAction<Order>(`/orders/${id}/cancel/`, { reason: reason ?? '' }),
  fulfill: (id: string, body: OrderFulfillInput) =>
    postAction<{ sale: unknown; order: Order }>(`/orders/${id}/fulfill/`, body),
  myToTake: () => retrieve<Order[]>('/orders/my-to-take/'),
  myToDeliver: () => retrieve<Order[]>('/orders/my-to-deliver/'),
  forLoading: () => retrieve<Order[]>('/orders/for-loading/'),
  buildLoading: (body: BuildLoadingInput) =>
    postAction<unknown>('/orders/build-loading/', body),
};
