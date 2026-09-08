import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  reports360Api,
  type DistributorFull,
  type PeriodPreset,
} from '@/shared/api/reports360';
import { DataState } from '@/shared/components/DataState';
import { PeriodSwitcher } from '@/shared/components/PeriodSwitcher';
import { dateShort, money } from '@/shared/lib/format';

type Tab =
  | 'overview'
  | 'money'
  | 'expenses'
  | 'clients'
  | 'products'
  | 'debts'
  | 'payroll';

const TABS: Array<{ id: Tab; l: string }> = [
  { id: 'overview', l: 'Umumiy' },
  { id: 'money', l: '💰 Pul harakati' },
  { id: 'expenses', l: '💸 Xarajatlar' },
  { id: 'clients', l: '🏪 Mijozlar' },
  { id: 'products', l: '📦 Mahsulotlar' },
  { id: 'debts', l: '💳 Qarzdorlik' },
  { id: 'payroll', l: '💵 Maosh' },
];

const PIE_COLORS = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#a855f7'];
const nfmt = (v: string | number): number => Number(v);

export function DistributorCardPage(): ReactElement {
  const { id = '' } = useParams();
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [tab, setTab] = useState<Tab>('overview');

  const query = useQuery({
    queryKey: ['distributor-360', id, preset],
    queryFn: () => reports360Api.full(id, { preset }),
    enabled: Boolean(id),
  });

  async function exportXlsx(): Promise<void> {
    const blob = await reports360Api.exportBlob(id, { preset });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xodim_${preset}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const d = query.data;

  return (
    <div className="space-y-4">
      <DataState isLoading={query.isLoading} isError={query.isError}>
        {d && (
          <>
            <Header d={d} onExport={() => void exportXlsx()} />
            <PeriodSwitcher value={preset} onChange={setPreset} />
            <KpiGrid d={d} />

            <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={`px-3 py-2 text-sm font-medium ${
                    tab === t.id
                      ? 'border-b-2 border-brand text-brand'
                      : 'text-gray-500'
                  }`}
                  onClick={() => setTab(t.id)}
                >
                  {t.l}
                </button>
              ))}
            </div>

            {tab === 'overview' && <OverviewTab d={d} />}
            {tab === 'money' && <MoneyTab d={d} />}
            {tab === 'expenses' && <ExpensesTab d={d} />}
            {tab === 'clients' && <ClientsTab d={d} />}
            {tab === 'products' && <ProductsTab d={d} />}
            {tab === 'debts' && <DebtsTab d={d} />}
            {tab === 'payroll' && <PayrollTab d={d} />}
          </>
        )}
      </DataState>
    </div>
  );
}

/* ------------------------------------------------------------------- header */

function Header({
  d,
  onExport,
}: {
  d: DistributorFull;
  onExport: () => void;
}): ReactElement {
  const online =
    d.distributor.last_seen_at &&
    Date.now() - new Date(d.distributor.last_seen_at).getTime() < 5 * 60_000;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{d.distributor.full_name}</h1>
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              online ? 'bg-success' : 'bg-gray-300'
            }`}
          />
        </div>
        <div className="text-sm text-gray-500">
          {d.distributor.phone}
          {d.distributor.route && ` · ${d.distributor.route}`}
          {d.distributor.hire_date && ` · ishga kirgan ${dateShort(d.distributor.hire_date)}`}
          {` · komissiya ${d.distributor.commission_percent}%`}
        </div>
      </div>
      <button
        className="btn flex items-center gap-1.5 px-4"
        onClick={onExport}
      >
        <Download size={16} aria-hidden /> Excel
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- kpi grid */

function Delta({ value }: { value: number | null | undefined }): ReactElement | null {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span className={`text-xs ${up ? 'text-success' : 'text-danger'}`}>
      {up ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  );
}

function Kpi({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string;
  delta?: number | null | undefined;
  accent?: string;
}): ReactElement {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-base font-bold ${accent ?? ''}`}>{value}</div>
      <Delta value={delta ?? null} />
    </div>
  );
}

function KpiGrid({ d }: { d: DistributorFull }): ReactElement {
  const c = d.changes;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Kpi label="Sotuv summasi" value={money(d.sales.total_amount)} delta={c.total_amount} />
      <Kpi
        label="Sof foyda"
        value={money(d.sales.total_profit)}
        delta={c.total_profit}
        accent="text-success"
      />
      <Kpi label="Sotuvlar soni" value={String(d.sales.sales_count)} delta={c.sales_count} />
      <Kpi label="O'rtacha chek" value={money(d.sales.avg_check)} delta={c.avg_check} />

      <Kpi
        label="Naqd yig'ildi"
        value={money(d.money.cash_collected)}
        delta={c.cash_collected}
      />
      <Kpi
        label="Xarajat"
        value={money(d.money.expenses_total)}
        delta={c.expenses_total}
        accent="text-expense"
      />
      <Kpi label="Topshirildi" value={money(d.money.handed_to_cashier)} />
      <Kpi
        label="👛 Qo'lida qolgan"
        value={money(d.money.wallet_balance)}
        accent={Number(d.money.wallet_balance) < 0 ? 'text-danger' : ''}
      />

      <Kpi label="Qarzga berdi" value={money(d.debts.given_total)} />
      <Kpi label="Qarz undirdi" value={money(d.debts.collected_total)} delta={c.debt_collected} />
      <Kpi
        label="Qoldiq qarz (marshrut)"
        value={money(d.debts.outstanding_total)}
        accent="text-danger"
      />
      <Kpi
        label="Kassa farqi"
        value={money(d.money.cash_differences_total)}
        accent={Number(d.money.cash_differences_total) < 0 ? 'text-danger' : ''}
      />

      <Kpi
        label="Reja bajarilishi"
        value={
          d.sales.plan_completion_percent === null
            ? '—'
            : `${d.sales.plan_completion_percent}%`
        }
      />
      <Kpi label="Tashriflar" value={String(d.clients.visited_count)} />
      <Kpi label="Yangi mijozlar" value={String(d.clients.new_clients)} />
      <Kpi label="Taxminiy maosh" value={money(d.payroll.estimated_total)} />
    </div>
  );
}

/* ------------------------------------------------------------------- tabs */

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function OverviewTab({ d }: { d: DistributorFull }): ReactElement {
  const daily = d.charts.daily_sales.map((r) => ({
    date: r.date.slice(5),
    Sotuv: nfmt(r.amount),
    Foyda: nfmt(r.profit),
    Xarajat: nfmt(r.expense),
  }));
  const mix = d.charts.payment_mix.map((r) => ({
    name: r.type,
    value: nfmt(r.amount),
  }));
  const hourly = d.charts.hourly_activity.map((r) => ({
    hour: `${r.hour}:00`,
    Summa: nfmt(r.amount),
  }));

  const o = d.orders;
  return (
    <div className="space-y-4">
      <Card title="Buyurtmalar (zakaz oqimi)">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-gray-500">Zakaz oldi</div>
            <div className="text-lg font-semibold">{o.taken_count}</div>
            <div className="text-xs text-gray-400">{money(o.taken_amount)}</div>
          </div>
          <div>
            <div className="text-gray-500">Yetkazdi</div>
            <div className="text-lg font-semibold">{o.delivered_count}</div>
            <div className="text-xs text-gray-400">{money(o.delivered_amount)}</div>
          </div>
          <div>
            <div className="text-gray-500">Bekor / kutilmoqda</div>
            <div className="text-lg font-semibold">
              {o.cancelled_count} / {o.pending_count}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Savdo · foyda · xarajat">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Legend />
              <Bar dataKey="Sotuv" fill="#6366f1" />
              <Line dataKey="Foyda" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line dataKey="Xarajat" stroke="#f97316" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="To'lov turlari">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={mix} dataKey="value" nameKey="name" outerRadius={80} label>
                  {mix.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => money(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Soatlik faollik">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="hour" fontSize={11} />
                <YAxis fontSize={11} width={70} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="Summa" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MoneyTab({ d }: { d: DistributorFull }): ReactElement {
  return (
    <Card title="Kunlik jurnal">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="p-2">Sana</th>
              <th className="p-2 text-right">Yuklandi</th>
              <th className="p-2 text-right">Sotildi</th>
              <th className="p-2 text-right">Qaytdi</th>
              <th className="p-2 text-right">Xarajat</th>
              <th className="p-2 text-right">Topshirdi</th>
              <th className="p-2 text-right">Farq</th>
              <th className="p-2">Holat</th>
            </tr>
          </thead>
          <tbody>
            {d.timeline.map((r) => (
              <tr
                key={r.date}
                className={`border-t border-gray-100 dark:border-gray-800 ${
                  Number(r.difference) < 0 ? 'bg-danger/5' : ''
                }`}
              >
                <td className="p-2">{dateShort(r.date)}</td>
                <td className="p-2 text-right">{money(r.loaded)}</td>
                <td className="p-2 text-right">{money(r.sold)}</td>
                <td className="p-2 text-right">{money(r.returned)}</td>
                <td className="p-2 text-right">{money(r.expense)}</td>
                <td className="p-2 text-right">{money(r.handed)}</td>
                <td
                  className={`p-2 text-right ${
                    Number(r.difference) < 0 ? 'text-danger' : ''
                  }`}
                >
                  {money(r.difference)}
                </td>
                <td className="p-2 text-xs text-gray-500">{r.status}</td>
              </tr>
            ))}
            {d.timeline.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-400">
                  Ma'lumot yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ExpensesTab({ d }: { d: DistributorFull }): ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={`Kategoriya bo'yicha · jami ${money(d.expenses.total)}`}>
        <ul className="space-y-1 text-sm">
          {d.expenses.by_category.map((r) => (
            <li key={r.category} className="flex justify-between">
              <span>{r.category}</span>
              <span className="font-medium">{money(r.total)}</span>
            </li>
          ))}
          {d.expenses.by_category.length === 0 && (
            <li className="text-gray-400">Xarajat yo'q</li>
          )}
        </ul>
      </Card>
      <Card title="Yoqilg'i">
        <div className="space-y-1 text-sm">
          <Row label="Litr" value={d.expenses.fuel.liters} />
          <Row label="Summa" value={money(d.expenses.fuel.amount)} />
          <Row label="O'rtacha narx" value={money(d.expenses.fuel.avg_price)} />
          <Row
            label="Savdoga nisbatan"
            value={`${d.expenses.fuel.cost_per_sale_percent}%`}
          />
          <Row label="Tasdiq kutmoqda" value={String(d.expenses.pending_count)} />
        </div>
      </Card>
    </div>
  );
}

function ClientsTab({ d }: { d: DistributorFull }): ReactElement {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Tashrif buyurdi" value={String(d.clients.visited_count)} />
        <Kpi label="Sotuv qilindi" value={String(d.clients.sold_to_count)} />
        <Kpi label="Sotuvsiz tashrif" value={String(d.clients.no_sale_visits)} />
        <Kpi label="Yangi mijoz" value={String(d.clients.new_clients)} />
      </div>
      <Card title="TOP mijozlar">
        <ul className="space-y-1 text-sm">
          {d.clients.top_clients.map((r) => (
            <li key={r.client} className="flex justify-between">
              <span>
                {r.client}{' '}
                <span className="text-gray-400">· {r.count} sotuv</span>
              </span>
              <span className="font-medium">{money(r.amount)}</span>
            </li>
          ))}
          {d.clients.top_clients.length === 0 && (
            <li className="text-gray-400">—</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function ProductsTab({ d }: { d: DistributorFull }): ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="TOP mahsulotlar">
        <ul className="space-y-1 text-sm">
          {d.products.top_products.map((r) => (
            <li key={r.product} className="flex justify-between">
              <span>
                {r.product} <span className="text-gray-400">· {r.quantity}</span>
              </span>
              <span className="font-medium">{money(r.amount)}</span>
            </li>
          ))}
          {d.products.top_products.length === 0 && (
            <li className="text-gray-400">—</li>
          )}
        </ul>
      </Card>
      <Card title="Kategoriya ulushi">
        <ul className="space-y-1 text-sm">
          {d.products.categories.map((r) => (
            <li key={r.category} className="flex justify-between">
              <span>{r.category}</span>
              <span className="font-medium">{money(r.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function DebtsTab({ d }: { d: DistributorFull }): ReactElement {
  return (
    <Card title="Qarzdorlik">
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <Row label="Bergan" value={money(d.debts.given_total)} />
        <Row label="Undirgan" value={money(d.debts.collected_total)} />
        <Row label="Qoldiq (marshrut)" value={money(d.debts.outstanding_total)} />
        <Row label="Muddati o'tgan" value={money(d.debts.overdue_amount)} danger />
        <Row
          label="Muddati o'tgan mijozlar"
          value={String(d.debts.overdue_clients_count)}
        />
        <Row
          label="Undirish foizi"
          value={
            d.debts.collection_rate === null ? '—' : `${d.debts.collection_rate}%`
          }
        />
      </div>
    </Card>
  );
}

function PayrollTab({ d }: { d: DistributorFull }): ReactElement {
  const p = d.payroll;
  return (
    <Card
      title={`Maosh · ${p.period.slice(0, 7)} · ${
        p.status === 'ESTIMATE' ? 'taxminiy' : p.status
      }`}
    >
      <div className="space-y-1 text-sm">
        <Row label="Asosiy maosh" value={money(p.base_salary)} />
        <Row label="Komissiya (jami)" value={money(p.commission_earned)} />
        {Number(p.order_commission) > 0 && (
          <Row label="↳ zakaz olgani uchun" value={money(p.order_commission)} />
        )}
        {Number(p.delivery_commission) > 0 && (
          <Row label="↳ yetkazgani uchun" value={money(p.delivery_commission)} />
        )}
        <Row label="Bonus" value={money(p.bonus)} />
        <Row label="Xarajat qaytarimi" value={`+${money(p.reimbursements)}`} />
        <Row label="Kamomad ushlanmasi" value={`−${money(p.deductions.shortage)}`} danger />
        <Row label="Kassa farqi ushlanmasi" value={`−${money(p.deductions.cash_diff)}`} danger />
        <Row label="Xarajat ushlanmasi" value={`−${money(p.deductions.expense)}`} danger />
        <Row label="Avans" value={`−${money(p.advances)}`} danger />
        <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
        <Row label="Yakuniy / taxminiy" value={money(p.estimated_total)} bold />
      </div>
      {p.status === 'ESTIMATE' && (
        <p className="mt-2 text-xs text-gray-400">
          Bu oy uchun maosh hali hisoblanmagan — Maosh bo'limida hisoblang.
        </p>
      )}
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  danger,
}: {
  label: string;
  value: string;
  bold?: boolean;
  danger?: boolean;
}): ReactElement {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${danger ? 'text-danger' : ''}`}>
        {value}
      </span>
    </div>
  );
}
