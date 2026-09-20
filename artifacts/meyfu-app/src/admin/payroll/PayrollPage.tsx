import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import {
  advanceApi,
  commissionRuleApi,
  payrollApi,
  type CommissionRule,
  type Payroll,
} from '@/shared/api/payroll';
import { authApi } from '@/shared/api/users';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money } from '@/shared/lib/format';

type Tab = 'payrolls' | 'rules' | 'advances';

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'text-gray-500',
  APPROVED: 'text-pending',
  PAID: 'text-success',
};

function thisMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function PayrollPage(): ReactElement {
  const [tab, setTab] = useState<Tab>('payrolls');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Maosh</h1>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {[
          { id: 'payrolls', l: 'Maoshlar' },
          { id: 'rules', l: 'Komissiya qoidalari' },
          { id: 'advances', l: 'Avanslar' },
        ].map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand text-brand' : 'text-gray-500'
            }`}
            onClick={() => setTab(t.id as Tab)}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'payrolls' && <PayrollsTab />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'advances' && <AdvancesTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ Maoshlar */

function PayrollsTab(): ReactElement {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<string>(thisMonthStart());
  const [distributor, setDistributor] = useState<string>('');
  const [open, setOpen] = useState<Payroll | null>(null);

  const distributors = useQuery({
    queryKey: ['distributors'],
    queryFn: () => authApi.distributors(),
  });
  const list = useQuery({
    queryKey: ['payrolls', { period }],
    queryFn: () => payrollApi.list({ period, page_size: 100, ordering: '-period' }),
  });

  const calc = useMutation({
    mutationFn: () => payrollApi.calculate(distributor, period),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ['payrolls'] });
      setOpen(p);
    },
  });

  const rows = list.data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
        <label className="space-y-1 text-sm">
          <span className="block text-gray-500">Davr (oy)</span>
          <input
            type="month"
            className="field"
            value={period.slice(0, 7)}
            onChange={(e) => setPeriod(`${e.target.value}-01`)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-gray-500">Tarqatuvchi</span>
          <select
            className="field min-w-[200px]"
            value={distributor}
            onChange={(e) => setDistributor(e.target.value)}
          >
            <option value="">— tanlang —</option>
            {distributors.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn-brand px-4"
          disabled={!distributor || calc.isPending}
          onClick={() => calc.mutate()}
        >
          {calc.isPending ? 'Hisoblanmoqda…' : 'Hisoblash'}
        </button>
      </div>

      {calc.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(calc.error)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={!list.isLoading && rows.length === 0}
          emptyText="Bu davr uchun maosh hisoblanmagan"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Tarqatuvchi</th>
                <th className="p-3 text-right">Sotuv</th>
                <th className="p-3 text-right">Komissiya</th>
                <th className="p-3 text-right">Ushlanma</th>
                <th className="p-3 text-right">Yakuniy</th>
                <th className="p-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  onClick={() => setOpen(p)}
                >
                  <td className="p-3 font-medium">{p.distributor_name}</td>
                  <td className="p-3 text-right">{money(p.total_sales)}</td>
                  <td className="p-3 text-right">{money(p.commission_amount)}</td>
                  <td className="p-3 text-right text-danger">
                    {money(p.total_deductions)}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {money(p.final_amount)}
                  </td>
                  <td className={`p-3 ${STATUS_CLASS[p.status] ?? ''}`}>
                    {p.status_display}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      {open && (
        <PayrollDetailModal payrollId={open.id} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function PayrollDetailModal({
  payrollId,
  onClose,
}: {
  payrollId: string;
  onClose: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const [bonus, setBonus] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const query = useQuery({
    queryKey: ['payroll', payrollId],
    queryFn: () => payrollApi.get(payrollId),
  });

  const refresh = (): void => {
    void qc.invalidateQueries({ queryKey: ['payroll', payrollId] });
    void qc.invalidateQueries({ queryKey: ['payrolls'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const edit = useMutation({
    mutationFn: () =>
      payrollApi.edit(payrollId, {
        ...(bonus !== '' ? { bonus } : {}),
        ...(note !== '' ? { note } : {}),
      }),
    onSuccess: refresh,
  });
  const approve = useMutation({
    mutationFn: () => payrollApi.approve(payrollId),
    onSuccess: refresh,
  });
  const pay = useMutation({
    mutationFn: () => payrollApi.pay(payrollId),
    onSuccess: refresh,
  });

  const p = query.data;
  const err = edit.error ?? approve.error ?? pay.error;

  return (
    <Modal open title="Maosh tafsiloti" onClose={onClose}>
      <DataState isLoading={query.isLoading} isError={query.isError}>
        {p && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">{p.distributor_name}</span>
              <span className="text-gray-500">{p.period.slice(0, 7)}</span>
            </div>

            <div className="space-y-1 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <Row label="Asosiy maosh" value={money(p.base_salary)} />
              <Row
                label={`Komissiya (${p.total_sales !== '0.00' ? money(p.total_sales) + ' sotuvdan' : '—'})`}
                value={money(p.commission_amount)}
              />
              {Number(p.order_commission_amount) > 0 && (
                <Row
                  label="↳ zakaz olgani uchun"
                  value={money(p.order_commission_amount)}
                />
              )}
              {Number(p.delivery_commission_amount) > 0 && (
                <Row
                  label="↳ yetkazgani uchun"
                  value={money(p.delivery_commission_amount)}
                />
              )}
              <Row label="Bonus" value={money(p.bonus)} />
              <Row
                label="Xarajat qaytarimi"
                value={`+${money(p.reimbursement_expense)}`}
              />
              <Row label="Tovar kamomadi" value={`−${money(p.deduction_shortage)}`} danger />
              <Row label="Kassa farqi" value={`−${money(p.deduction_cash_diff)}`} danger />
              <Row label="Xarajat ushlanmasi" value={`−${money(p.deduction_expense)}`} danger />
              <Row label="Avans" value={`−${money(p.advance)}`} danger />
              <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
              <Row label="Yakuniy summa" value={money(p.final_amount)} bold />
            </div>

            {p.details.length > 0 && (
              <details className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                <summary className="cursor-pointer text-gray-500">
                  Komissiya tafsiloti ({p.details.length} qator)
                </summary>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {p.details.map((d) => (
                      <tr key={d.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                        <td className="py-1">{dateShort(d.sale_date)}</td>
                        <td className="py-1">{d.product_name}</td>
                        <td className="py-1 text-gray-400">{d.role_display}</td>
                        <td className="py-1 text-right">{d.percent}%</td>
                        <td className="py-1 text-right">{money(d.commission_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}

            {err && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-danger">
                {extractApiError(err)}
              </p>
            )}

            {p.status === 'DRAFT' && (
              <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="text-gray-500">Qo'lda tuzatish</div>
                <div className="flex gap-2">
                  <input
                    className="field"
                    type="number"
                    placeholder={`Bonus (${p.bonus})`}
                    value={bonus}
                    onChange={(e) => setBonus(e.target.value)}
                  />
                  <input
                    className="field"
                    placeholder="Izoh"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    className="btn px-3"
                    disabled={edit.isPending || (bonus === '' && note === '')}
                    onClick={() => edit.mutate()}
                  >
                    Saqlash
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {p.status === 'DRAFT' && (
                <button
                  className="btn-brand flex-1"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate()}
                >
                  Tasdiqlash
                </button>
              )}
              {p.status === 'APPROVED' && (
                <button
                  className="btn flex-1 bg-success text-white"
                  disabled={pay.isPending}
                  onClick={() => pay.mutate()}
                >
                  To'landi deb belgilash
                </button>
              )}
              {p.status === 'PAID' && (
                <p className="flex-1 text-center text-success">
                  To'langan · {p.paid_at ? dateShort(p.paid_at) : ''}
                </p>
              )}
            </div>
          </div>
        )}
      </DataState>
    </Modal>
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

/* ------------------------------------------------------ Komissiya qoidalari */

const SCOPE_OPTIONS: Array<{ v: CommissionRule['scope']; l: string }> = [
  { v: 'GLOBAL', l: 'Umumiy' },
  { v: 'CATEGORY', l: 'Kategoriya' },
  { v: 'PRODUCT', l: 'Mahsulot' },
  { v: 'DISTRIBUTOR', l: 'Tarqatuvchi' },
];

function RulesTab(): ReactElement {
  const qc = useQueryClient();
  const [form, setForm] = useState<{
    scope: CommissionRule['scope'];
    target_id: string;
    percent: string;
    valid_from: string;
    priority: string;
  }>({
    scope: 'GLOBAL',
    target_id: '',
    percent: '',
    valid_from: thisMonthStart(),
    priority: '0',
  });

  const list = useQuery({
    queryKey: ['commission-rules'],
    queryFn: () => commissionRuleApi.list({ page_size: 100 }),
  });

  const add = useMutation({
    mutationFn: () =>
      commissionRuleApi.create({
        scope: form.scope,
        target_id: form.scope === 'GLOBAL' ? null : form.target_id || null,
        percent: form.percent,
        valid_from: form.valid_from,
        priority: Number(form.priority),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commission-rules'] });
      setForm((f) => ({ ...f, percent: '', target_id: '' }));
    },
  });
  const toggle = useMutation({
    mutationFn: (r: CommissionRule) =>
      commissionRuleApi.update(r.id, { is_active: !r.is_active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['commission-rules'] }),
  });

  const rows = list.data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
        <div className="mb-2 text-sm font-medium">Yangi qoida</div>
        <div className="flex flex-wrap items-end gap-2">
          <select
            className="field"
            value={form.scope}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                scope: e.target.value as CommissionRule['scope'],
              }))
            }
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
          {form.scope !== 'GLOBAL' && (
            <input
              className="field"
              placeholder="Obyekt ID (UUID)"
              value={form.target_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, target_id: e.target.value }))
              }
            />
          )}
          <input
            className="field w-24"
            type="number"
            placeholder="Foiz"
            value={form.percent}
            onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))}
          />
          <input
            className="field w-40"
            type="date"
            value={form.valid_from}
            onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
          />
          <input
            className="field w-24"
            type="number"
            placeholder="Ustuvorlik"
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
          />
          <button
            className="btn-brand px-4"
            disabled={!form.percent || add.isPending}
            onClick={() => add.mutate()}
          >
            Qo'shish
          </button>
        </div>
        {add.isError && (
          <p className="mt-2 text-sm text-danger">{extractApiError(add.error)}</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Aniqlik darajasi: Tarqatuvchi &gt; Mahsulot &gt; Kategoriya &gt; Umumiy,
          keyin ustuvorlik.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={!list.isLoading && rows.length === 0}
          emptyText="Qoida yo'q — profil foizi ishlatiladi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Qamrov</th>
                <th className="p-3">Obyekt</th>
                <th className="p-3 text-right">Foiz</th>
                <th className="p-3 text-right">Ustuvorlik</th>
                <th className="p-3">Amal qiladi</th>
                <th className="p-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3">{r.scope_display}</td>
                  <td className="p-3 font-mono text-xs text-gray-400">
                    {r.target_id ? r.target_id.slice(0, 8) : '—'}
                  </td>
                  <td className="p-3 text-right font-medium">{r.percent}%</td>
                  <td className="p-3 text-right">{r.priority}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {dateShort(r.valid_from)}
                    {r.valid_to ? ` – ${dateShort(r.valid_to)}` : ''}
                  </td>
                  <td className="p-3">
                    <button
                      className={r.is_active ? 'text-success' : 'text-gray-400'}
                      onClick={() => toggle.mutate(r)}
                    >
                      {r.is_active ? 'Faol' : 'O‘chirilgan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Avanslar */

function AdvancesTab(): ReactElement {
  const qc = useQueryClient();
  const [distributor, setDistributor] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const distributors = useQuery({
    queryKey: ['distributors'],
    queryFn: () => authApi.distributors(),
  });
  const list = useQuery({
    queryKey: ['advances'],
    queryFn: () => advanceApi.list({ page_size: 100, ordering: '-date' }),
  });

  const add = useMutation({
    mutationFn: () =>
      advanceApi.create({ distributor, amount, ...(note ? { note } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['advances'] });
      setAmount('');
      setNote('');
    },
  });

  const rows = list.data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
        <select
          className="field min-w-[180px]"
          value={distributor}
          onChange={(e) => setDistributor(e.target.value)}
        >
          <option value="">— tarqatuvchi —</option>
          {distributors.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>
        <input
          className="field w-40"
          type="number"
          placeholder="Summa"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="field"
          placeholder="Izoh"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          className="btn-brand px-4"
          disabled={!distributor || !amount || add.isPending}
          onClick={() => add.mutate()}
        >
          Avans berish
        </button>
      </div>

      {add.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(add.error)}
        </p>
      )}
      <p className="text-xs text-gray-400">
        Avans hamyonga (+) va kassadan (−) yoziladi, o'sha oy maoshidan ushlanadi.
      </p>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={!list.isLoading && rows.length === 0}
          emptyText="Avans yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Sana</th>
                <th className="p-3">Tarqatuvchi</th>
                <th className="p-3 text-right">Summa</th>
                <th className="p-3">Izoh</th>
                <th className="p-3">Maoshda</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3">{dateShort(a.date)}</td>
                  <td className="p-3">{a.distributor_name}</td>
                  <td className="p-3 text-right font-medium">{money(a.amount)}</td>
                  <td className="p-3 text-gray-500">{a.note || '—'}</td>
                  <td className="p-3 text-xs">
                    {a.payroll ? (
                      <span className="text-success">hisobga olindi</span>
                    ) : (
                      <span className="text-gray-400">kutmoqda</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  );
}
