import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CircleCheckBig, HandCoins, Plus } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { saveDebtPaymentLocal } from '@/offline/actions';
import { db } from '@/offline/db';
import { useSync } from '@/offline/useSync';
import { clientsApi } from '@/shared/api/clients';
import { extractApiError } from '@/shared/api/client';
import { debtsApi } from '@/shared/api/debts';
import { AmountInput } from '@/shared/components/AmountInput';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { money } from '@/shared/lib/format';
import { hasUserPermission } from '@/shared/lib/permissions';
import { useAuthStore } from '@/shared/store/authStore';
import type { Client } from '@/shared/types/clients';

import { CheckInSheet } from './CheckInSheet';
import { NewClientModal } from './NewClientModal';

const ADVANCE_ROLES = new Set(['WAREHOUSE', 'MANAGER', 'SUPER_ADMIN', 'ACCOUNTANT']);

export function MyClientsPage(): ReactElement {
  const qc = useQueryClient();
  const [search, setSearch] = useState<string>('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [advanceClient, setAdvanceClient] = useState<Client | null>(null);
  const [advAmount, setAdvAmount] = useState<string>('');
  const [advType, setAdvType] = useState<'NAQD' | 'PLASTIK' | 'OTKAZMA'>('NAQD');
  const [advNote, setAdvNote] = useState<string>('');
  const [debtClient, setDebtClient] = useState<Client | null>(null);
  const [debtAmount, setDebtAmount] = useState<string>('');
  const [debtNote, setDebtNote] = useState<string>('');
  const [collectClient, setCollectClient] = useState<Client | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payInitializedFor, setPayInitializedFor] = useState<string | null>(null);
  const [payType, setPayType] = useState<'NAQD' | 'PLASTIK' | 'OTKAZMA'>('NAQD');
  const [paySaved, setPaySaved] = useState<boolean>(false);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const navigate = useNavigate();
  const { online } = useSync();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  // Zakaz oluvchida tashrif (check-in) yo'q — mijozni bossa buyurtma ochiladi
  const isOrderTaker = role === 'ORDER_TAKER';
  const canRecordAdvance = role != null && ADVANCE_ROLES.has(role);
  const canCollectDebts = hasUserPermission(user, 'can_collect_debts');
  const pick = (c: Client): void => {
    if (isOrderTaker) void navigate(`/m/order/new?client=${c.id}`);
    else setSelected(c);
  };

  const advanceMut = useMutation({
    mutationFn: () => {
      if (!advanceClient) throw new Error('Client required');
      return clientsApi.recordAdvance(advanceClient.id, {
        amount: advAmount,
        payment_type: advType,
        ...(advNote.trim() ? { note: advNote.trim() } : {}),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      setAdvanceClient(null);
      setAdvAmount('');
      setAdvNote('');
    },
  });

  const debtMut = useMutation({
    mutationFn: () => {
      if (!debtClient) throw new Error('Client required');
      return clientsApi.openingBalance({
        client: debtClient.id,
        amount: debtAmount,
        ...(debtNote.trim() ? { note: debtNote.trim() } : {}),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['debts'] });
      setDebtClient(null);
      setDebtAmount('');
      setDebtNote('');
    },
  });

  const clientDebtsQuery = useQuery({
    queryKey: ['debts', 'client', 'by-client', collectClient?.id],
    enabled: collectClient !== null,
    queryFn: async (): Promise<Array<{ remaining: string }>> => {
      if (!collectClient) return [];
      try {
        const page = await debtsApi.byClient({ client: collectClient.id, only_open: 1 });
        return page.results;
      } catch (err) {
        const cached = (await db.debts.toArray()).filter(
          (d) => d.client === collectClient.id && Number(d.remaining) > 0,
        );
        if (cached.length > 0 || !navigator.onLine) return cached;
        throw err;
      }
    },
  });

  const totalClientDebt = useMemo(
    () => (clientDebtsQuery.data ?? []).reduce((s, d) => s + Number(d.remaining), 0),
    [clientDebtsQuery.data],
  );

  useEffect(() => {
    if (collectClient && totalClientDebt > 0 && payInitializedFor !== collectClient.id) {
      setPayAmount(String(Math.round(totalClientDebt)));
      setPayInitializedFor(collectClient.id);
    }
  }, [collectClient, totalClientDebt, payInitializedFor]);

  const collectMut = useMutation({
    mutationFn: async () => {
      if (!collectClient || totalClientDebt <= 0) throw new Error('Debt required');
      await saveDebtPaymentLocal({
        client: collectClient.id,
        client_name: collectClient.name,
        client_phone: collectClient.phone,
        amount: Number(payAmount),
        payment_type: payType,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['debts'] });
      setPaySaved(true);
    },
  });

  function closeCollectModal(): void {
    collectMut.reset();
    setCollectClient(null);
    setPayAmount('');
    setPayInitializedFor(null);
    setPaySaved(false);
  }

  const myDebtsSummary = useQuery({
    queryKey: ['debts', 'my-summary'],
    queryFn: () => debtsApi.byClient({ only_open: 1, page_size: 500 }),
  });

  const query = useQuery({
    queryKey: ['clients', 'mine', search],
    queryFn: () =>
      // Marshrut tartibida (v5 C4 — optimallashtirilgan tashrif ketma-ketligi)
      clientsApi.list({
        search: search || undefined,
        page_size: 100,
        ordering: 'route__name,route_order,name',
      }),
  });

  const rows = query.data?.results ?? [];
  const totalMyClientsDebt = myDebtsSummary.data?.results
    ? myDebtsSummary.data.results.reduce((s, d) => s + Number(d.remaining || 0), 0)
    : rows.reduce((s, c) => s + Math.max(0, Number(c.current_debt || 0)), 0);
  const debtorsCount = myDebtsSummary.data?.results
    ? myDebtsSummary.data.results.length
    : rows.filter((c) => Number(c.current_debt || 0) > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mening mijozlarim</h1>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="btn-brand flex items-center gap-1 px-3 py-1.5 text-xs font-medium"
        >
          <Plus size={16} aria-hidden /> Yangi mijoz
        </button>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-sm dark:bg-gray-900">
        <div>
          <div className="text-xs text-gray-500">Mijozlarimdan jami qarzdorlik</div>
          <div className="text-xs text-gray-400">{debtorsCount} ta qarzdor mijoz</div>
        </div>
        <div className="text-lg font-extrabold text-danger">{money(totalMyClientsDebt)}</div>
      </div>
      <input
        className="field"
        placeholder="Qidirish…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Marshrutingizda mijoz yo‘q"
      >
        <ul className="space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <button
                onClick={() => pick(c)}
                className="flex w-full items-center justify-between text-left active:scale-[0.99]"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">
                    {[c.phone, c.address || c.owner_name].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="text-right text-xs">
                  {c.is_blocked && (
                    <div className="font-medium text-danger">Bloklangan</div>
                  )}
                  {Number(c.current_debt) > 0 && (
                    <div className="text-danger">Qarz: {money(c.current_debt)}</div>
                  )}
                  {Number(c.advance_balance ?? 0) > 0 && (
                    <div className="font-medium text-emerald-600 dark:text-emerald-400">
                      Avans: {money(c.advance_balance ?? '0')}
                    </div>
                  )}
                </div>
              </button>
              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                {canCollectDebts && Number(c.current_debt) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      collectMut.reset();
                      setCollectClient(c);
                      setPayAmount('');
                      setPayInitializedFor(null);
                      setPayType('NAQD');
                      setPaySaved(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/20"
                  >
                    <HandCoins size={14} aria-hidden />
                    To&apos;lov qabul qilish
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDebtClient(c);
                    setDebtAmount('');
                    setDebtNote('');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300"
                >
                  Eski qarz (+)
                </button>
                {canRecordAdvance && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdvanceClient(c);
                      setAdvAmount('');
                      setAdvType('NAQD');
                      setAdvNote('');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
                  >
                    <Banknote size={14} aria-hidden />
                    Ortiqcha to&apos;lov (avans)
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DataState>

      <CheckInSheet client={selected} onClose={() => setSelected(null)} />
      <Modal
        open={advanceClient !== null}
        title={advanceClient ? `Ortiqcha to'lov (avans): ${advanceClient.name}` : ''}
        onClose={() => {
          advanceMut.reset();
          setAdvanceClient(null);
        }}
      >
        {advanceClient && (
          <div className="space-y-3">
            {Number(advanceClient.advance_balance ?? 0) > 0 && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                Joriy avans: {money(advanceClient.advance_balance ?? '0')}
              </div>
            )}
            <AmountInput
              className="text-lg"
              ariaLabel="Avans summasi"
              value={advAmount}
              onChange={setAdvAmount}
            />
            <div className="flex gap-2">
              {(['NAQD', 'PLASTIK', 'OTKAZMA'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setAdvType(tp)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium ${
                    advType === tp ? 'bg-brand text-brand-fg' : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  {tp}
                </button>
              ))}
            </div>
            <input
              className="field"
              placeholder="Izoh (ixtiyoriy)"
              value={advNote}
              onChange={(e) => setAdvNote(e.target.value)}
            />
            {advanceMut.isError && (
              <p className="text-sm text-danger">{extractApiError(advanceMut.error)}</p>
            )}
            <button
              type="button"
              className="btn-brand w-full"
              disabled={Number(advAmount) <= 0 || advanceMut.isPending}
              onClick={() => advanceMut.mutate()}
            >
              {advanceMut.isPending ? 'Saqlanmoqda…' : 'Avansni saqlash'}
            </button>
          </div>
        )}
      </Modal>
      <Modal
        open={debtClient !== null}
        title={debtClient ? `Eski qarz kiritish: ${debtClient.name}` : ''}
        onClose={() => {
          debtMut.reset();
          setDebtClient(null);
        }}
      >
        {debtClient && (
          <div className="space-y-3">
            {Number(debtClient.current_debt) > 0 && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Joriy qarz: {money(debtClient.current_debt)}
              </div>
            )}
            <AmountInput
              className="text-lg"
              ariaLabel="Qarz summasi"
              value={debtAmount}
              onChange={setDebtAmount}
            />
            <input
              className="field"
              placeholder="Izoh (masalan: eski qolib ketgan qarz)"
              value={debtNote}
              onChange={(e) => setDebtNote(e.target.value)}
            />
            {debtMut.isError && (
              <p className="text-sm text-danger">{extractApiError(debtMut.error)}</p>
            )}
            <button
              type="button"
              className="btn-brand w-full"
              disabled={Number(debtAmount) <= 0 || debtMut.isPending}
              onClick={() => debtMut.mutate()}
            >
              {debtMut.isPending ? 'Saqlanmoqda…' : 'Qarzni saqlash'}
            </button>
          </div>
        )}
      </Modal>
      <NewClientModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={(created) => {
          pick(created);
        }}
      />
      <Modal
        open={collectClient !== null}
        title={collectClient ? `To'lov qabul qilish: ${collectClient.name}` : ''}
        onClose={closeCollectModal}
      >
        {collectClient && (
          paySaved ? (
            <div className="space-y-3 py-6 text-center">
              <CircleCheckBig size={48} className="mx-auto text-success" aria-hidden />
              <p className="font-semibold">To&apos;lov saqlandi</p>
              <p className="text-sm text-gray-500">
                {online
                  ? 'Serverga yuborilmoqda…'
                  : "Internet yo'q — ulanish paydo bo'lganda yuboriladi."}
              </p>
              <button type="button" className="btn-brand px-6" onClick={closeCollectModal}>
                Yopish
              </button>
            </div>
          ) : (
            <DataState
              isLoading={clientDebtsQuery.isLoading}
              isError={clientDebtsQuery.isError}
              isEmpty={!clientDebtsQuery.isLoading && (clientDebtsQuery.data?.length ?? 0) === 0}
              emptyText="Ushbu mijozda ochiq qarz topilmadi"
            >
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  Jami qoldiq: <strong className="text-danger">{money(totalClientDebt)}</strong>
                </div>
                <AmountInput
                  className="text-lg"
                  ariaLabel="To'lov summasi"
                  value={payAmount}
                  onChange={setPayAmount}
                />
                <div className="flex gap-2">
                  {(['NAQD', 'PLASTIK', 'OTKAZMA'] as const).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setPayType(tp)}
                      className={`flex-1 rounded-lg py-2 text-xs font-medium ${
                        payType === tp ? 'bg-brand text-brand-fg' : 'bg-gray-100 dark:bg-gray-800'
                      }`}
                    >
                      {tp}
                    </button>
                  ))}
                </div>
                {collectMut.isError && (
                  <p className="text-sm text-danger" role="alert">
                    {extractApiError(collectMut.error)}
                  </p>
                )}
                <button
                  type="button"
                  className="btn-brand w-full"
                  disabled={
                    Number(payAmount) <= 0 ||
                    Number(payAmount) > totalClientDebt ||
                    collectMut.isPending
                  }
                  onClick={() => collectMut.mutate()}
                >
                  {collectMut.isPending ? 'Saqlanmoqda…' : "To'lovni qabul qilish"}
                </button>
              </div>
            </DataState>
          )
        )}
      </Modal>
    </div>
  );
}
