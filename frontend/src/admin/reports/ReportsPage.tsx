import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { authApi } from '@/shared/api/users';
import {
  downloadBlob,
  reportsAdvancedApi,
  type ReportDimension,
} from '@/shared/api/reportsAdvanced';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';

type Tab = 'query' | 'abc' | 'pnl';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'query', label: 'Konstruktor' },
  { id: 'abc', label: 'ABC tahlil' },
  { id: 'pnl', label: 'Foyda-zarar' },
];

const QUERY_DIMS: Array<{ v: ReportDimension; l: string }> = [
  { v: 'product', l: 'Mahsulot' },
  { v: 'category', l: 'Kategoriya' },
  { v: 'client', l: 'Mijoz' },
  { v: 'distributor', l: 'Tarqatuvchi' },
  { v: 'route', l: 'Marshrut' },
  { v: 'day', l: 'Kun' },
  { v: 'payment_type', l: "To'lov turi" },
];

const ABC_DIMS: Array<{ v: ReportDimension; l: string }> = [
  { v: 'product', l: 'Mahsulot' },
  { v: 'client', l: 'Mijoz' },
  { v: 'category', l: 'Kategoriya' },
];

const PAYMENT_TYPES = ['NAQD', 'PLASTIK', 'OTKAZMA', 'QARZ', 'ARALASH'];

const ABC_CLASS_STYLE: Record<string, string> = {
  A: 'bg-success/15 text-success',
  B: 'bg-pending/15 text-pending',
  C: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsPage(): ReactElement {
  const [tab, setTab] = useState<Tab>('query');
  const [dateFrom, setDateFrom] = useState<string>(firstOfMonth());
  const [dateTo, setDateTo] = useState<string>(today());

  const range = { date_from: dateFrom, date_to: dateTo };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hisobotlar</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-gray-500">Dan</span>
          <input
            type="date"
            className="field"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-500">Gacha</span>
          <input
            type="date"
            className="field"
            value={dateTo}
            min={dateFrom}
            max={today()}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand text-brand' : 'text-gray-500'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'query' && <QueryTab range={range} />}
      {tab === 'abc' && <AbcTab range={range} />}
      {tab === 'pnl' && <PnlTab range={range} />}
    </div>
  );
}

interface Range {
  [k: string]: string;
  date_from: string;
  date_to: string;
}

function ExportButtons({
  params,
  filename,
}: {
  params: Record<string, string>;
  filename: string;
}): ReactElement {
  async function run(fmt: 'xlsx' | 'pdf'): Promise<void> {
    const blob = await reportsAdvancedApi.exportBlob({ ...params, fmt });
    downloadBlob(blob, `${filename}.${fmt}`);
  }
  return (
    <div className="flex gap-2">
      <button
        className="btn flex items-center gap-1.5 px-3"
        onClick={() => void run('xlsx')}
      >
        <Download size={16} aria-hidden /> Excel
      </button>
      <button
        className="btn flex items-center gap-1.5 px-3"
        onClick={() => void run('pdf')}
      >
        <Download size={16} aria-hidden /> PDF
      </button>
    </div>
  );
}

function QueryTab({ range }: { range: Range }): ReactElement {
  const [dimension, setDimension] = useState<ReportDimension>('product');
  const [distributor, setDistributor] = useState<string>('');
  const [paymentType, setPaymentType] = useState<string>('');

  const distributors = useQuery({
    queryKey: ['distributors-lite'],
    queryFn: () => authApi.distributors(),
  });

  const filters = useMemo(
    () => ({
      dimension,
      ...range,
      ...(distributor ? { distributor } : {}),
      ...(paymentType ? { payment_type: paymentType } : {}),
    }),
    [dimension, distributor, paymentType, range],
  );

  const query = useQuery({
    queryKey: ['report-query', filters],
    queryFn: () => reportsAdvancedApi.query(filters),
  });

  const keyName = query.data?.key ?? dimension;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select
            className="field max-w-[180px]"
            value={dimension}
            onChange={(e) => setDimension(e.target.value as ReportDimension)}
          >
            {QUERY_DIMS.map((d) => (
              <option key={d.v} value={d.v}>
                {d.l}
              </option>
            ))}
          </select>
          <select
            className="field max-w-[200px]"
            value={distributor}
            onChange={(e) => setDistributor(e.target.value)}
          >
            <option value="">Barcha tarqatuvchilar</option>
            {distributors.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
          <select
            className="field max-w-[160px]"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
          >
            <option value="">Barcha to'lovlar</option>
            {PAYMENT_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <ExportButtons
          params={{
            type: 'query',
            dimension,
            ...range,
            ...(distributor ? { distributor } : {}),
            ...(paymentType ? { payment_type: paymentType } : {}),
          }}
          filename={`hisobot_${dimension}`}
        />
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && (query.data?.rows.length ?? 0) === 0}
          emptyText="Ma'lumot yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3 capitalize">{keyName}</th>
                <th className="p-3 text-right">Summa</th>
                <th className="p-3 text-right">Foyda</th>
                <th className="p-3 text-right">Margin %</th>
                <th className="p-3 text-right">Miqdor</th>
                <th className="p-3 text-right">Sotuvlar</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.rows.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3">{String(r[keyName])}</td>
                  <td className="p-3 text-right">{money(r.amount)}</td>
                  <td className="p-3 text-right text-success">{money(r.profit)}</td>
                  <td className="p-3 text-right">{r.margin_percent}%</td>
                  <td className="p-3 text-right">{r.qty}</td>
                  <td className="p-3 text-right">{r.count}</td>
                </tr>
              ))}
            </tbody>
            {query.data && (
              <tfoot className="border-t-2 border-gray-200 font-semibold dark:border-gray-700">
                <tr>
                  <td className="p-3">JAMI</td>
                  <td className="p-3 text-right">{money(query.data.totals.amount)}</td>
                  <td className="p-3 text-right text-success">
                    {money(query.data.totals.profit)}
                  </td>
                  <td className="p-3 text-right">
                    {query.data.totals.margin_percent}%
                  </td>
                  <td className="p-3 text-right">{query.data.totals.qty}</td>
                  <td className="p-3 text-right">{query.data.totals.count}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </DataState>
      </div>
    </div>
  );
}

function AbcTab({ range }: { range: Range }): ReactElement {
  const [dimension, setDimension] = useState<ReportDimension>('product');

  const query = useQuery({
    queryKey: ['report-abc', dimension, range],
    queryFn: () => reportsAdvancedApi.abc({ dimension, ...range }),
  });

  const keyName = query.data?.key ?? dimension;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          className="field max-w-[180px]"
          value={dimension}
          onChange={(e) => setDimension(e.target.value as ReportDimension)}
        >
          {ABC_DIMS.map((d) => (
            <option key={d.v} value={d.v}>
              {d.l}
            </option>
          ))}
        </select>
        <ExportButtons
          params={{ type: 'abc', dimension, ...range }}
          filename={`abc_${dimension}`}
        />
      </div>

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && (query.data?.rows.length ?? 0) === 0}
        emptyText="Ma'lumot yo'q"
      >
        {query.data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {query.data.summary.map((s) => (
                <div
                  key={s.abc_class}
                  className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 text-xs font-bold ${
                        ABC_CLASS_STYLE[s.abc_class]
                      }`}
                    >
                      {s.abc_class}
                    </span>
                    <span className="text-xs text-gray-500">{s.count} ta</span>
                  </div>
                  <div className="mt-1 text-lg font-bold">{money(s.amount)}</div>
                  <div className="text-xs text-gray-400">{s.amount_percent}%</div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
                  <tr>
                    <th className="p-3 capitalize">{keyName}</th>
                    <th className="p-3 text-right">Summa</th>
                    <th className="p-3 text-right">Ulush %</th>
                    <th className="p-3 text-right">Jami %</th>
                    <th className="p-3 text-center">Sinf</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.rows.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="p-3">{String(r[keyName])}</td>
                      <td className="p-3 text-right">{money(r.amount)}</td>
                      <td className="p-3 text-right">{r.share_percent}%</td>
                      <td className="p-3 text-right text-gray-400">
                        {r.cumulative_percent}%
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`rounded px-1.5 text-xs font-bold ${
                            ABC_CLASS_STYLE[r.abc_class]
                          }`}
                        >
                          {r.abc_class}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}

function PnlTab({ range }: { range: Range }): ReactElement {
  const query = useQuery({
    queryKey: ['report-pnl', range],
    queryFn: () => reportsAdvancedApi.profit(range),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportButtons
          params={{ type: 'pnl', ...range }}
          filename="foyda_zarar"
        />
      </div>

      <DataState isLoading={query.isLoading} isError={query.isError}>
        {query.data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <PnlCard label="Tushum" value={money(query.data.revenue)} />
              <PnlCard
                label="Yalpi foyda"
                value={money(query.data.gross_profit)}
                accent="text-success"
              />
              <PnlCard
                label="Tarqatuvchi xarajatlari"
                value={money(query.data.distributor_expenses)}
                accent="text-expense"
              />
              <PnlCard
                label="Kompaniya xarajatlari"
                value={money(query.data.company_expenses)}
                accent="text-expense"
              />
              <PnlCard
                label="Sof foyda"
                value={money(query.data.net_profit)}
                accent={
                  Number(query.data.net_profit) < 0 ? 'text-danger' : 'text-success'
                }
              />
              <PnlCard label="Kassa balansi" value={money(query.data.cash_balance)} />
            </div>

            {query.data.company_expenses_by_category.length > 0 && (
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
                    <tr>
                      <th className="p-3">Kompaniya xarajati — kategoriya</th>
                      <th className="p-3 text-right">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.company_expenses_by_category.map((c) => (
                      <tr
                        key={c.category}
                        className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                      >
                        <td className="p-3">{c.category}</td>
                        <td className="p-3 text-right">{money(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

function PnlCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}): ReactElement {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent ?? ''}`}>{value}</div>
    </div>
  );
}
