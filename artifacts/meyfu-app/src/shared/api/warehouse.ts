import { api } from '@/shared/api/client';
import {
  create,
  listPage,
  patch,
  postAction,
  retrieve,
  type QueryParams,
} from '@/shared/api/crud';
import type {
  InventoryCount,
  InventoryItemInput,
  Loading,
  LoadingInput,
  Purchase,
  PurchaseInput,
  Stock,
  StockMovement,
  Supplier,
  SupplierTransaction,
  Transfer,
  TransferInput,
  VanStock,
  Warehouse,
} from '@/shared/types/warehouse';

export const warehouseApi = {
  warehouses: (params?: QueryParams) => listPage<Warehouse>('/warehouses/', params),
  createWarehouse: (body: { name: string; address?: string }) =>
    create<Warehouse, { name: string }>('/warehouses/', body),

  suppliers: (params?: QueryParams) => listPage<Supplier>('/suppliers/', params),
  createSupplier: (body: { name: string; phone?: string; inn?: string }) =>
    create<Supplier, { name: string }>('/suppliers/', body),
  /** Ta'minotchi boshlang'ich qoldig'i (faqat SUPER_ADMIN, ishorali). */
  supplierOpeningBalance: (body: { supplier: string; amount: string; note?: string }) =>
    postAction<SupplierTransaction>('/suppliers/opening-balance/', body),
  supplierTransactions: (params?: QueryParams) =>
    listPage<SupplierTransaction>('/supplier-transactions/', params),

  stock: (params?: QueryParams) => listPage<Stock>('/stock/', params),
  lowStock: () => retrieve<Stock[]>('/stock/low/'),
  stockMovements: (params?: QueryParams) =>
    listPage<StockMovement>('/stock-movements/', params),
  /** Mavjud mahsulot uchun boshlang'ich qoldiq (yaratish oqimidan mustaqil). */
  stockOpeningBalance: (body: {
    product: string;
    warehouse: string;
    quantity: string;
    note?: string;
  }) => postAction<StockMovement>('/stock/opening-balance/', body),
  lockOpening: (warehouse: string) =>
    postAction<Warehouse>('/stock/lock-opening/', { warehouse }),
  unlockOpening: (warehouse: string) =>
    postAction<Warehouse>('/stock/unlock-opening/', { warehouse }),

  purchases: (params?: QueryParams) => listPage<Purchase>('/purchases/', params),
  purchase: (id: string) => retrieve<Purchase>(`/purchases/${id}/`),
  createPurchase: (body: PurchaseInput) =>
    create<Purchase, PurchaseInput>('/purchases/', body),
  confirmPurchase: (id: string) =>
    postAction<Purchase>(`/purchases/${id}/confirm/`),
  purchasePdf: (id: string, stamp: boolean) =>
    api
      .get(`/purchases/${id}/pdf/${stamp ? '?stamp=1' : ''}`, {
        responseType: 'blob',
      })
      .then((r) => r.data as Blob),
  loadingPdf: (id: string, stamp: boolean) =>
    api
      .get(`/loadings/${id}/pdf/${stamp ? '?stamp=1' : ''}`, {
        responseType: 'blob',
      })
      .then((r) => r.data as Blob),

  loadings: (params?: QueryParams) => listPage<Loading>('/loadings/', params),
  loading: (id: string) => retrieve<Loading>(`/loadings/${id}/`),
  createLoading: (body: LoadingInput) =>
    create<Loading, LoadingInput>('/loadings/', body),
  /** Faqat DRAFT holatida (backend boshqasini rad etadi) */
  updateLoading: (id: string, body: LoadingInput) =>
    patch<Loading, LoadingInput>(`/loadings/${id}/`, body),
  sendLoading: (id: string) => postAction<Loading>(`/loadings/${id}/send/`),
  confirmLoading: (id: string) => postAction<Loading>(`/loadings/${id}/confirm/`),
  cancelLoading: (id: string) => postAction<unknown>(`/loadings/${id}/cancel/`),
  myTodayLoadings: () => retrieve<Loading[]>('/loadings/my-today/'),

  inventoryCounts: (params?: QueryParams) =>
    listPage<InventoryCount>('/inventory-counts/', params),
  inventoryCount: (id: string) => retrieve<InventoryCount>(`/inventory-counts/${id}/`),
  /** Yaratilganda ombordagi barcha tovarlar avtomatik to'ldiriladi */
  createInventoryCount: (body: { warehouse: string; date: string; note?: string }) =>
    create<InventoryCount, typeof body>('/inventory-counts/', body),
  /** Hisobdagi qoldiqni yangilaydi — kiritilgan haqiqiy qoldiq saqlanadi */
  fillInventoryCount: (id: string) =>
    postAction<InventoryCount>(`/inventory-counts/${id}/fill/`),
  saveInventoryItems: (id: string, items: InventoryItemInput[]) =>
    patch<InventoryCount, { items: InventoryItemInput[] }>(
      `/inventory-counts/${id}/items/`,
      { items },
    ),
  confirmInventoryCount: (id: string) =>
    postAction<InventoryCount>(`/inventory-counts/${id}/confirm/`),
  cancelInventoryCount: (id: string) =>
    postAction<InventoryCount>(`/inventory-counts/${id}/cancel/`),

  transfers: (params?: QueryParams) => listPage<Transfer>('/transfers/', params),
  transfer: (id: string) => retrieve<Transfer>(`/transfers/${id}/`),
  createTransfer: (body: TransferInput) => create<Transfer, TransferInput>('/transfers/', body),
  /** Faqat qoralama */
  updateTransfer: (id: string, body: TransferInput) =>
    patch<Transfer, TransferInput>(`/transfers/${id}/`, body),
  /** Manba ombordan chiqim — tovar yo'lda */
  sendTransfer: (id: string) => postAction<Transfer>(`/transfers/${id}/send/`),
  /** Farq bo'lsa izoh majburiy (backend tekshiradi) */
  receiveTransfer: (
    id: string,
    body: { items: Array<{ id: string; received_quantity: string }>; note?: string },
  ) => postAction<Transfer>(`/transfers/${id}/receive/`, body),
  cancelTransfer: (id: string) => postAction<Transfer>(`/transfers/${id}/cancel/`),

  myVanStock: () => retrieve<VanStock[]>('/van-stock/my/'),
  vanStock: (params?: QueryParams) => listPage<VanStock>('/van-stock/', params),
};
