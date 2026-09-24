import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';
import { clientsApi } from '@/shared/api/clients';
import { debtsApi } from '@/shared/api/debts';
import { walletApi } from '@/shared/api/finance';
import { financeApi } from '@/shared/api/finance2';
import { staffApi } from '@/shared/api/users';
import { warehouseApi } from '@/shared/api/warehouse';
import { AmountInput } from '@/shared/components/AmountInput';
import { DataState } from '@/shared/components/DataState';
import { SignedAmountInput } from '@/shared/components/SignedAmountInput';
import { dateShort, money, qty } from '@/shared/lib/format';

type TabId = 'products' | 'cash' | 'suppliers' | 'clients' | 'staff';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'products', label: 'Tovarlar' },
  { id: 'cash', label: 'Kassa' },
  { id: 'suppliers', label: "Ta'minotchilar" },
  { id: 'clients', label: 'Mijozlar' },
  { id: 'staff', label: 'Xodimlar' },
];

export function OpeningBalancesPage(): ReactElement {
  const [tab, setTab] = useState<TabId>('products');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Boshlang'ich qoldiqlar</h1>
      <p className="text-sm text-gray-500">
        Tizimni birinchi marta sozlashda yoki mavjud yozuvlarga tuzatish
        kiritishda — tovar, kassa, ta'minotchi, mijoz va xodim boshlang'ich
        holatini shu yerdan kiriting.
      </p>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand text-brand' : 'text-gray-500'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab />}
      {tab === 'cash' && <CashTab />}
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'clients' && <ClientsTab />}
      {tab === 'staff' && <StaffTab />}
    </div>
  );
}

function FormShell({
  children,
  error,
  onSubmit,
  disabled,
}: {
  children: ReactElement | (ReactElement | false | null)[];
  error: unknown;
  onSubmit: () => void;
  disabled: boolean;
}): ReactElement {
  return (
    <div className="max-w-xl space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      {children}
      {Boolean(error) && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(error)}
        </p>
      )}
      <button className="btn-brand w-full" disabled={disabled} onClick={onSubmit}>
        Saqlash
      </button>
    </div>
  );
}

function HistoryTable({
  rows,
  isLoading,
  isError,
  kind = 'money',
}: {
  /** 'qty' — tovar miqdori (dona), aks holda pul (audit m6) */
  kind?: 'money' | 'qty';
  rows: Array<{
    id: string;
    date: string;
    label: string;
    amount: string;
    balanceAfter?: string;
    note?: string;
  }>;
  isLoading: boolean;
  isError: boolean;
}): ReactElement {
  return (
    <div className="max-w-xl overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
      <DataState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!isLoading && rows.length === 0}
        emptyText="Hali yozuv yo'q"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
            <tr>
              <th className="p-3">Sana</th>
              <th className="p-3">Turi</th>
              <th className="p-3 text-right">{kind === 'qty' ? 'Miqdor' : 'Summa'}</th>
              <th className="p-3">Izoh</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-gray-100 last:border-0 dark:border-gray-800"
              >
                <td className="p-3">{dateShort(r.date)}</td>
                <td className="p-3">{r.label}</td>
                <td
                  className={`p-3 text-right font-medium ${
                    Number(r.amount) < 0 ? 'text-danger' : 'text-success'
                  }`}
                >
                  {Number(r.amount) > 0 ? '+' : ''}
                  {kind === 'qty' ? qty(r.amount) : money(r.amount)}
                </td>
                <td className="p-3 text-gray-500">{r.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataState>
    </div>
  );
}

/* ---------------------------------------------------------------- Tovarlar */

function ProductsTab(): ReactElement {
  const qc = useQueryClient();
  const [product, setProduct] = useState<string>('');
  const [warehouse, setWarehouse] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const products = useQuery({
    queryKey: ['products-all'],
    queryFn: () => catalogApi.products({ page_size: 500, is_active: 'true' }),
  });
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 200 }),
  });
  const history = useQuery({
    queryKey: ['stock-movements', 'opening'],
    queryFn: () =>
      warehouseApi.stockMovements({
        movement_type: 'OPENING_BALANCE',
        page_size: 20,
        ordering: '-created_at',
      }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      warehouseApi.stockOpeningBalance({ product, warehouse, quantity, note }),
    onSuccess: () => {
      setQuantity('');
      setNote('');
      void qc.invalidateQueries({ queryKey: ['stock-movements', 'opening'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  return (
    <div className="space-y-4">
      <FormShell
        error={mutation.error}
        disabled={!product || !warehouse || !quantity || mutation.isPending}
        onSubmit={() => mutation.mutate()}
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Mahsulot</span>
          <select
            className="field"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="">— tanlang —</option>
            {products.data?.results.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Ombor</span>
          <select
            className="field"
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="">— tanlang —</option>
            {warehouses.data?.results.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Miqdor</span>
          <AmountInput
            value={quantity}
            onChange={setQuantity}
            showWords={false}
            suffix=""
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Izoh (ixtiyoriy)</span>
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </FormShell>

      <HistoryTable
        kind="qty"
        isLoading={history.isLoading}
        isError={history.isError}
        rows={(history.data?.results ?? []).map((m) => ({
          id: m.id,
          date: m.created_at,
          label: `${m.product_sku} · ${m.movement_type_display}`,
          amount: m.quantity,
          note: m.note,
        }))}
      />
    </div>
  );
}

/* -------------------------------------------------------------------- Kassa */

function CashTab(): ReactElement {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const account = useQuery({
    queryKey: ['cash-account'],
    queryFn: () => financeApi.cashAccount(),
  });
  const history = useQuery({
    queryKey: ['cash-tx', 'opening'],
    queryFn: () =>
      financeApi.cashTransactions({
        transaction_type: 'OPENING_BALANCE',
        page_size: 20,
      }),
  });

  const mutation = useMutation({
    mutationFn: () => financeApi.openingBalance({ amount, note }),
    onSuccess: () => {
      setAmount('');
      setNote('');
      void qc.invalidateQueries({ queryKey: ['cash-tx', 'opening'] });
      void qc.invalidateQueries({ queryKey: ['cash-account'] });
      void qc.invalidateQueries({ queryKey: ['profit'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="max-w-xl rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <span className="text-sm text-gray-500">Joriy balans</span>
        <div className="text-xl font-bold">{money(account.data?.balance ?? '0')}</div>
      </div>

      <FormShell
        error={mutation.error}
        disabled={!amount || mutation.isPending}
        onSubmit={() => mutation.mutate()}
      >
        <SignedAmountInput
          value={amount}
          onChange={setAmount}
          positiveLabel="Kassada bor (+)"
          negativeLabel="Kamomad (−)"
        />
        <input
          className="field"
          placeholder="Izoh (ixtiyoriy)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormShell>

      <HistoryTable
        isLoading={history.isLoading}
        isError={history.isError}
        rows={(history.data?.results ?? []).map((t) => ({
          id: t.id,
          date: t.date,
          label: t.type_display,
          amount: t.amount,
          note: t.note,
        }))}
      />
    </div>
  );
}

/* --------------------------------------------------------- Ta'minotchilar */

function SuppliersTab(): ReactElement {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const suppliers = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => warehouseApi.suppliers({ page_size: 200 }),
  });
  const history = useQuery({
    queryKey: ['supplier-tx', 'opening'],
    queryFn: () => warehouseApi.supplierTransactions({ page_size: 20 }),
  });

  const mutation = useMutation({
    mutationFn: () => warehouseApi.supplierOpeningBalance({ supplier, amount, note }),
    onSuccess: () => {
      setAmount('');
      setNote('');
      void qc.invalidateQueries({ queryKey: ['supplier-tx', 'opening'] });
      void qc.invalidateQueries({ queryKey: ['suppliers-all'] });
    },
  });

  return (
    <div className="space-y-4">
      <p className="max-w-xl rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800">
        Faqat boshlang'ich holat uchun — keyingi xaridlar va to'lovlar bu
        balansga avtomatik qo'shilmaydi.
      </p>

      <FormShell
        error={mutation.error}
        disabled={!supplier || !amount || mutation.isPending}
        onSubmit={() => mutation.mutate()}
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Ta'minotchi</span>
          <select
            className="field"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">— tanlang —</option>
            {suppliers.data?.results.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <SignedAmountInput
          value={amount}
          onChange={setAmount}
          positiveLabel="Biz qarzdormiz (+)"
          negativeLabel="U qarzdor (−)"
        />
        <input
          className="field"
          placeholder="Izoh (ixtiyoriy)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormShell>

      <HistoryTable
        isLoading={history.isLoading}
        isError={history.isError}
        rows={(history.data?.results ?? []).map((t) => ({
          id: t.id,
          date: t.date,
          label: t.transaction_type,
          amount: t.amount,
          note: t.note,
        }))}
      />
    </div>
  );
}

/* -------------------------------------------------------------------- Mijozlar */

function ClientsTab(): ReactElement {
  const qc = useQueryClient();
  const [client, setClient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const clients = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => clientsApi.list({ page_size: 500, is_blocked: 'false' }),
  });
  const history = useQuery({
    queryKey: ['debts', 'opening', client],
    queryFn: () =>
      debtsApi.list({ client: client || undefined, page_size: 20, ordering: '-created_at' }),
    enabled: Boolean(client),
  });

  const mutation = useMutation({
    mutationFn: () => clientsApi.openingBalance({ client, amount, note }),
    onSuccess: () => {
      setAmount('');
      setNote('');
      void qc.invalidateQueries({ queryKey: ['debts', 'opening', client] });
      void qc.invalidateQueries({ queryKey: ['clients-all'] });
    },
  });

  return (
    <div className="space-y-4">
      <FormShell
        error={mutation.error}
        disabled={!client || !amount || mutation.isPending}
        onSubmit={() => mutation.mutate()}
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Mijoz</span>
          <select
            className="field"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          >
            <option value="">— tanlang —</option>
            {clients.data?.results.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Boshlang'ich qarz</span>
          <AmountInput value={amount} onChange={setAmount} showWords={false} />
        </label>
        <input
          className="field"
          placeholder="Izoh (ixtiyoriy)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormShell>

      {client && (
        <HistoryTable
          isLoading={history.isLoading}
          isError={history.isError}
          rows={(history.data?.results ?? []).map((d) => ({
            id: d.id,
            date: d.created_at,
            label: d.sale ? `Sotuv ${d.sale_number ?? ''}` : "Boshlang'ich qarz",
            amount: d.amount,
            note: `Qoldiq: ${qty(d.remaining)}`,
          }))}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- Xodimlar */

function StaffTab(): ReactElement {
  const qc = useQueryClient();
  const [staff, setStaff] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const staffList = useQuery({
    queryKey: ['staff-all'],
    queryFn: () => staffApi.list({ is_active: 'true', page_size: 200 }),
  });
  const history = useQuery({
    queryKey: ['wallet-tx', 'opening'],
    queryFn: () =>
      walletApi.transactions({ transaction_type: 'OPENING_BALANCE', page_size: 20 }),
  });

  const mutation = useMutation({
    mutationFn: () => walletApi.openingBalance({ distributor: staff, amount, note }),
    onSuccess: () => {
      setAmount('');
      setNote('');
      void qc.invalidateQueries({ queryKey: ['wallet-tx', 'opening'] });
    },
  });

  return (
    <div className="space-y-4">
      <FormShell
        error={mutation.error}
        disabled={!staff || !amount || mutation.isPending}
        onSubmit={() => mutation.mutate()}
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Xodim</span>
          <select
            className="field"
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
          >
            <option value="">— tanlang —</option>
            {staffList.data?.results.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </label>
        <SignedAmountInput
          value={amount}
          onChange={setAmount}
          positiveLabel="Xodimga berilgan (avans)"
          negativeLabel="Xodimning qarzi"
        />
        <input
          className="field"
          placeholder="Izoh (ixtiyoriy)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormShell>

      <HistoryTable
        isLoading={history.isLoading}
        isError={history.isError}
        rows={(history.data?.results ?? []).map((t) => ({
          id: t.id,
          date: t.date,
          label: t.type_display,
          amount: t.amount,
          note: t.note,
        }))}
      />
    </div>
  );
}
