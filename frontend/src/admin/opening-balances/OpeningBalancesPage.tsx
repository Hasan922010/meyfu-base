import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { debtsApi } from '@/shared/api/debts';
import { walletApi } from '@/shared/api/finance';
import { financeApi } from '@/shared/api/finance2';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money, qty } from '@/shared/lib/format';
import { ROLE_LABELS } from '@/shared/lib/labels';
import { useAuthStore } from '@/shared/store/authStore';
import type { Role } from '@/shared/types/api';

import { BalanceGrid } from './BalanceGrid';

type TabId = 'products' | 'cash' | 'suppliers' | 'clients' | 'staff';

// Kim kirita oladi — backenddagi `opening_balance`/`opening_balance_bulk`
// action_roles bilan bir xil. Qolganlar faqat tarixni ko'radi (audit K3b).
const TABS: Array<{ id: TabId; label: string; writeRoles: Role[] }> = [
  {
    id: 'products',
    label: 'Tovarlar',
    writeRoles: ['WAREHOUSE', 'MANAGER', 'BRANCH_MANAGER', 'SUPER_ADMIN'],
  },
  { id: 'cash', label: 'Kassa', writeRoles: ['SUPER_ADMIN'] },
  { id: 'suppliers', label: "Ta'minotchilar", writeRoles: ['SUPER_ADMIN'] },
  { id: 'clients', label: 'Mijozlar', writeRoles: ['MANAGER', 'SUPER_ADMIN'] },
  { id: 'staff', label: 'Xodimlar', writeRoles: ['SUPER_ADMIN'] },
];

/** Joriy tab uchun yozish ruxsati; `null` — ruxsat bor */
const ReadOnlyContext = createContext<Role[] | null>(null);

export function OpeningBalancesPage(): ReactElement {
  const [tab, setTab] = useState<TabId>('products');
  const role = useAuthStore((s) => s.user?.role);
  const writeRoles = TABS.find((t) => t.id === tab)?.writeRoles ?? [];
  const readOnly = role && writeRoles.includes(role) ? null : writeRoles;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Boshlang'ich qoldiqlar</h1>
      <p className="text-sm text-gray-500">
        Ro'yxat avtomatik to'ldiriladi — har qatorga haqiqiy (yakuniy) qoldiqni
        yozing, farqni tizim o'zi hisoblaydi. Bo'sh qoldirilgan qatorlar
        o'zgarmaydi.
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

      <ReadOnlyContext.Provider value={readOnly}>
        {tab === 'products' && <ProductsTab />}
        {tab === 'cash' && <CashTab />}
        {tab === 'suppliers' && <SuppliersTab />}
        {tab === 'clients' && <ClientsTab />}
        {tab === 'staff' && <StaffTab />}
      </ReadOnlyContext.Provider>
    </div>
  );
}

/** Yozish ruxsati bo'lmasa — ro'yxat o'rniga izoh (tarix baribir ko'rinadi). */
function WriteGate({ children }: { children: ReactNode }): ReactElement {
  const writeRoles = useContext(ReadOnlyContext);
  if (writeRoles) {
    return (
      <p className="max-w-xl rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        Faqat ko‘rish: bu bo‘limga yozuvni {writeRoles.map((r) => ROLE_LABELS[r]).join(' yoki ')}{' '}
        kiritadi. Quyida kiritilganlar tarixi.
      </p>
    );
  }
  return <>{children}</>;
}

interface HistoryRow {
  id: string;
  date: string;
  label: string;
  amount: string;
  note?: string;
}

function HistoryTable({
  rows,
  isLoading,
  isError,
  kind = 'money',
}: {
  /** 'qty' — tovar miqdori (dona), aks holda pul (audit m6) */
  kind?: 'money' | 'qty';
  rows: HistoryRow[];
  isLoading: boolean;
  isError: boolean;
}): ReactElement {
  return (
    <div className="space-y-1">
      <h2 className="text-sm font-semibold text-gray-500">Oxirgi kiritilganlar</h2>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
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
    </div>
  );
}

/* ---------------------------------------------------------------- Tovarlar */

function ProductsTab(): ReactElement {
  const qc = useQueryClient();
  const [warehouse, setWarehouse] = useState<string>('');

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

  return (
    <div className="space-y-4">
      <WriteGate>
        <div className="space-y-3">
          <label className="block max-w-xs space-y-1">
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
          {/* key — ombor almashsa kiritilganlar boshqa omborga o'tib ketmasin */}
          <BalanceGrid
            key={warehouse}
            kind="stock"
            warehouse={warehouse}
            valueKind="qty"
            rules={{ allowNegative: false, increaseOnly: false }}
            hint="Ombordagi barcha tovarlar ro'yxati. Haqiqiy miqdorni yozing — farq boshlang'ich qoldiq sifatida yoziladi."
            onSaved={() => {
              void qc.invalidateQueries({ queryKey: ['stock-movements', 'opening'] });
              void qc.invalidateQueries({ queryKey: ['stock'] });
            }}
          />
        </div>
      </WriteGate>

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
  const history = useQuery({
    queryKey: ['cash-tx', 'opening'],
    queryFn: () =>
      financeApi.cashTransactions({
        transaction_type: 'OPENING_BALANCE',
        page_size: 20,
      }),
  });

  return (
    <div className="space-y-4">
      <WriteGate>
        <BalanceGrid
          kind="cash"
          rules={{ allowNegative: true, increaseOnly: false }}
          hint="Kassadagi haqiqiy summani yozing. Manfiy qiymat — kamomad."
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ['cash-tx', 'opening'] });
            void qc.invalidateQueries({ queryKey: ['cash-account'] });
            void qc.invalidateQueries({ queryKey: ['profit'] });
          }}
        />
      </WriteGate>

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
  const history = useQuery({
    queryKey: ['supplier-tx', 'opening'],
    queryFn: () => warehouseApi.supplierTransactions({ page_size: 20 }),
  });

  return (
    <div className="space-y-4">
      <WriteGate>
        <BalanceGrid
          kind="suppliers"
          rules={{ allowNegative: true, increaseOnly: false }}
          hint="Musbat — biz qarzdormiz, manfiy — ta'minotchi qarzdor. Faqat boshlang'ich holat uchun: keyingi xaridlar va to'lovlar bu balansga avtomatik qo'shilmaydi."
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ['supplier-tx', 'opening'] });
            void qc.invalidateQueries({ queryKey: ['suppliers-all'] });
          }}
        />
      </WriteGate>

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
  const history = useQuery({
    queryKey: ['debts', 'opening'],
    queryFn: () => debtsApi.list({ page_size: 50, ordering: '-created_at' }),
  });
  // Boshlang'ich qarz — sotuvsiz yaratilgan qarz yozuvi
  const openingDebts = (history.data?.results ?? []).filter((d) => !d.sale);

  return (
    <div className="space-y-4">
      <WriteGate>
        <BalanceGrid
          kind="clients"
          rules={{ allowNegative: false, increaseOnly: true }}
          hint="Mijozning umumiy qarzini yozing — farq sotuvsiz boshlang'ich qarz bo'lib qo'shiladi. Qarzni kamaytirish qarz to'lovi orqali kiritiladi."
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ['debts'] });
            void qc.invalidateQueries({ queryKey: ['clients-all'] });
          }}
        />
      </WriteGate>

      <HistoryTable
        isLoading={history.isLoading}
        isError={history.isError}
        rows={openingDebts.map((d) => ({
          id: d.id,
          date: d.created_at,
          label: d.client_name,
          amount: d.amount,
          note: `Qoldiq: ${money(d.remaining)}`,
        }))}
      />
    </div>
  );
}

/* --------------------------------------------------------------------- Xodimlar */

function StaffTab(): ReactElement {
  const qc = useQueryClient();
  const history = useQuery({
    queryKey: ['wallet-tx', 'opening'],
    queryFn: () =>
      walletApi.transactions({ transaction_type: 'OPENING_BALANCE', page_size: 20 }),
  });

  return (
    <div className="space-y-4">
      <WriteGate>
        <BalanceGrid
          kind="staff"
          rules={{ allowNegative: true, increaseOnly: false }}
          hint="Musbat — xodimga berilgan (avans), manfiy — xodimning qarzi."
          onSaved={() => void qc.invalidateQueries({ queryKey: ['wallet-tx', 'opening'] })}
        />
      </WriteGate>

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
