import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { clientsApi } from '@/shared/api/clients';
import { extractApiError } from '@/shared/api/client';
import { AmountInput } from '@/shared/components/AmountInput';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { money } from '@/shared/lib/format';
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
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  // Zakaz oluvchida tashrif (check-in) yo'q — mijozni bossa buyurtma ochiladi
  const isOrderTaker = role === 'ORDER_TAKER';
  const canRecordAdvance = role != null && ADVANCE_ROLES.has(role);
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
              {canRecordAdvance && (
                <div className="flex justify-end border-t border-gray-100 pt-2 dark:border-gray-800">
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
                </div>
              )}
            </li>
          ))}
        </ul>
      </DataState>

      <CheckInSheet client={selected} onClose={() => setSelected(null)} />
      <Modal
        open={advanceClient !== null}
        title={advanceClient ? `Ortiqcha to'lov (avans): ${advanceClient.name}` : ''}
        onClose={() => setAdvanceClient(null)}
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
      <NewClientModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={(created) => {
          pick(created);
        }}
      />
    </div>
  );
}
