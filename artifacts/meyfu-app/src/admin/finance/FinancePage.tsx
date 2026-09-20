import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { financeApi } from '@/shared/api/finance2';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money } from '@/shared/lib/format';

const CATEGORIES = [
  { v: 'RENT', l: 'Ijara' },
  { v: 'SALARY', l: 'Maosh' },
  { v: 'UTILITIES', l: 'Kommunal' },
  { v: 'TRANSPORT', l: 'Transport' },
  { v: 'MARKETING', l: 'Marketing' },
  { v: 'TAX', l: 'Soliq' },
  { v: 'OTHER', l: 'Boshqa' },
];

const CASH_TYPES = [
  { v: 'OTHER_IN', l: 'Kirim (+)' },
  { v: 'BANK_DEPOSIT', l: 'Bankka topshirish (−)' },
  { v: 'SUPPLIER_PAYMENT', l: 'Yetkazib beruvchiga (−)' },
  { v: 'OTHER_OUT', l: 'Chiqim (−)' },
];

export function FinancePage(): ReactElement {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'cash' | 'company'>('overview');
  const [expModal, setExpModal] = useState<boolean>(false);
  const [cashModal, setCashModal] = useState<boolean>(false);

  const profit = useQuery({ queryKey: ['profit'], queryFn: () => financeApi.profit() });
  const account = useQuery({
    queryKey: ['cash-account'],
    queryFn: () => financeApi.cashAccount(),
  });
  const cashTx = useQuery({
    queryKey: ['cash-tx'],
    queryFn: () => financeApi.cashTransactions({ page_size: 50 }),
    enabled: tab === 'cash',
  });
  const companyExp = useQuery({
    queryKey: ['company-expenses'],
    queryFn: () => financeApi.companyExpenses({ page_size: 50 }),
    enabled: tab === 'company',
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Moliya</h1>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {[
          { id: 'overview', l: 'Umumiy' },
          { id: 'cash', l: 'Kassa' },
          { id: 'company', l: 'Kompaniya xarajatlari' },
        ].map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand text-brand' : 'text-gray-500'
            }`}
            onClick={() => setTab(t.id as 'overview' | 'cash' | 'company')}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <DataState isLoading={profit.isLoading} isError={profit.isError}>
          {profit.data && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Card label="Kassa balansi" value={money(profit.data.cash_balance)} />
                <Card label="Tushum (davr)" value={money(profit.data.revenue)} />
                <Card
                  label="Yalpi foyda"
                  value={money(profit.data.gross_profit)}
                  accent="text-success"
                />
                <Card
                  label="Tarqatuvchi xarajatlari"
                  value={money(profit.data.distributor_expenses)}
                  accent="text-expense"
                />
                <Card
                  label="Kompaniya xarajatlari"
                  value={money(profit.data.company_expenses)}
                  accent="text-expense"
                />
                <Card
                  label="Sof foyda"
                  value={money(profit.data.net_profit)}
                  accent={
                    Number(profit.data.net_profit) < 0 ? 'text-danger' : 'text-success'
                  }
                />
              </div>
              <p className="text-xs text-gray-400">
                Davr: {profit.data.date_from} — {profit.data.date_to}
              </p>
            </div>
          )}
        </DataState>
      )}

      {tab === 'cash' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
            <span className="text-sm text-gray-500">Joriy balans</span>
            <span className="text-xl font-bold">
              {money(account.data?.balance ?? '0')}
            </span>
          </div>
          <button className="btn-brand px-4" onClick={() => setCashModal(true)}>
            + Kassa yozuvi
          </button>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
            <DataState
              isLoading={cashTx.isLoading}
              isError={cashTx.isError}
              isEmpty={!cashTx.isLoading && (cashTx.data?.results.length ?? 0) === 0}
              emptyText="Yozuv yo'q"
            >
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
                  <tr>
                    <th className="p-3">Sana</th>
                    <th className="p-3">Turi</th>
                    <th className="p-3">Kontragent</th>
                    <th className="p-3 text-right">Summa</th>
                    <th className="p-3 text-right">Balans</th>
                  </tr>
                </thead>
                <tbody>
                  {cashTx.data?.results.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="p-3">{dateShort(t.date)}</td>
                      <td className="p-3">{t.type_display}</td>
                      <td className="p-3">{t.counterparty || '—'}</td>
                      <td
                        className={`p-3 text-right font-medium ${
                          Number(t.amount) < 0 ? 'text-danger' : 'text-success'
                        }`}
                      >
                        {Number(t.amount) > 0 ? '+' : ''}
                        {money(t.amount)}
                      </td>
                      <td className="p-3 text-right text-gray-400">
                        {money(t.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataState>
          </div>
        </div>
      )}

      {tab === 'company' && (
        <div className="space-y-3">
          <button className="btn-brand px-4" onClick={() => setExpModal(true)}>
            + Kompaniya xarajati
          </button>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
            <DataState
              isLoading={companyExp.isLoading}
              isError={companyExp.isError}
              isEmpty={
                !companyExp.isLoading && (companyExp.data?.results.length ?? 0) === 0
              }
              emptyText="Xarajat yo'q"
            >
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
                  <tr>
                    <th className="p-3">Sana</th>
                    <th className="p-3">Kategoriya</th>
                    <th className="p-3">Izoh</th>
                    <th className="p-3 text-right">Summa</th>
                    <th className="p-3">Kassadan</th>
                  </tr>
                </thead>
                <tbody>
                  {companyExp.data?.results.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="p-3">{dateShort(e.date)}</td>
                      <td className="p-3">{e.category_display}</td>
                      <td className="p-3">{e.description || '—'}</td>
                      <td className="p-3 text-right font-medium">{money(e.amount)}</td>
                      <td className="p-3">{e.paid_from_cash ? 'Ha' : "Yo'q"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataState>
          </div>
        </div>
      )}

      <CompanyExpenseModal
        open={expModal}
        onClose={() => setExpModal(false)}
        onDone={() => {
          void qc.invalidateQueries({ queryKey: ['company-expenses'] });
          void qc.invalidateQueries({ queryKey: ['profit'] });
          void qc.invalidateQueries({ queryKey: ['cash-account'] });
          setExpModal(false);
        }}
      />
      <CashTxModal
        open={cashModal}
        onClose={() => setCashModal(false)}
        onDone={() => {
          void qc.invalidateQueries({ queryKey: ['cash-tx'] });
          void qc.invalidateQueries({ queryKey: ['cash-account'] });
          void qc.invalidateQueries({ queryKey: ['profit'] });
          setCashModal(false);
        }}
      />
    </div>
  );
}

function Card({
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

function CompanyExpenseModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}): ReactElement {
  const [category, setCategory] = useState<string>('RENT');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [fromCash, setFromCash] = useState<boolean>(true);

  const mutation = useMutation({
    mutationFn: () =>
      financeApi.createCompanyExpense({
        category,
        amount,
        description,
        paid_from_cash: fromCash,
      }),
    onSuccess: onDone,
  });

  return (
    <Modal open={open} title="Kompaniya xarajati" onClose={onClose}>
      <div className="space-y-3">
        <select
          className="field"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.v} value={c.v}>
              {c.l}
            </option>
          ))}
        </select>
        <input
          className="field"
          type="number"
          placeholder="Summa"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="field"
          placeholder="Izoh"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fromCash}
            onChange={(e) => setFromCash(e.target.checked)}
          />
          Kassadan to'lansin
        </label>
        {mutation.isError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(mutation.error)}
          </p>
        )}
        <button
          className="btn-brand w-full"
          disabled={Number(amount) <= 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Saqlash
        </button>
      </div>
    </Modal>
  );
}

function CashTxModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}): ReactElement {
  const [type, setType] = useState<string>('OTHER_IN');
  const [amount, setAmount] = useState<string>('');
  const [counterparty, setCounterparty] = useState<string>('');

  const mutation = useMutation({
    mutationFn: () =>
      financeApi.createCashTransaction({
        transaction_type: type,
        amount,
        counterparty,
      }),
    onSuccess: onDone,
  });

  return (
    <Modal open={open} title="Kassa yozuvi" onClose={onClose}>
      <div className="space-y-3">
        <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
          {CASH_TYPES.map((c) => (
            <option key={c.v} value={c.v}>
              {c.l}
            </option>
          ))}
        </select>
        <input
          className="field"
          type="number"
          placeholder="Summa"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="field"
          placeholder="Kontragent (ixtiyoriy)"
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
        />
        {mutation.isError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(mutation.error)}
          </p>
        )}
        <button
          className="btn-brand w-full"
          disabled={Number(amount) <= 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Saqlash
        </button>
      </div>
    </Modal>
  );
}
