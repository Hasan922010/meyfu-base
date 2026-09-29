import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type KeyboardEvent, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { openingApi, type OpeningKind } from '@/shared/api/opening';
import { DataState } from '@/shared/components/DataState';
import { money, qty } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/toast';

import { changedTargets, hasIssues, rowIssue, searchRows, type GridRules } from './gridRules';

interface Props {
  kind: OpeningKind;
  /** Tovarlar uchun — qaysi ombor (tanlanmaguncha ro'yxat yuklanmaydi) */
  warehouse?: string;
  valueKind?: 'money' | 'qty';
  rules: GridRules;
  /** Ishora ma'nosi va cheklovlar — foydalanuvchiga tushuntirish */
  hint: string;
  onSaved?: () => void;
}

/** Enter — keyingi qatorning "Yangi qoldiq" maydoniga o'tadi. */
function focusNext(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[data-opening-target]'),
  );
  const next = inputs[inputs.indexOf(e.currentTarget) + 1];
  next?.focus();
  next?.select();
}

function diffTone(diff: number): string {
  if (diff === 0) return 'text-gray-400';
  return diff > 0 ? 'text-success' : 'text-danger';
}

export function BalanceGrid({
  kind,
  warehouse,
  valueKind = 'money',
  rules,
  hint,
  onSaved,
}: Props): ReactElement {
  const qc = useQueryClient();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const needsWarehouse = kind === 'stock';
  const sheet = useQuery({
    queryKey: ['opening-sheet', kind, warehouse ?? ''],
    queryFn: () => openingApi.sheet(kind, warehouse),
    enabled: !needsWarehouse || Boolean(warehouse),
  });
  const rows = sheet.data ?? [];
  const changes = changedTargets(rows, drafts, rules);
  const blocked = hasIssues(rows, drafts, rules);
  const fmt = valueKind === 'qty' ? qty : money;

  const mutation = useMutation({
    mutationFn: () =>
      openingApi.bulk(kind, {
        rows: changes,
        ...(note ? { note } : {}),
        ...(warehouse ? { warehouse } : {}),
      }),
    onSuccess: (result) => {
      setDrafts({});
      setNote('');
      toast.push({ kind: 'success', title: `${result.applied} ta yozuv saqlandi` });
      void qc.invalidateQueries({ queryKey: ['opening-sheet', kind] });
      onSaved?.();
    },
  });

  if (needsWarehouse && !warehouse) {
    return <p className="text-sm text-gray-500">Ro'yxat chiqishi uchun omborni tanlang.</p>;
  }

  const visible = searchRows(rows, search);

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800">
        {hint}
      </p>
      <input
        className="field max-w-xs"
        placeholder="Nomi yoki kodi bo'yicha qidirish"
        aria-label="Ro'yxatdan qidirish"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="max-h-[60vh] overflow-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={sheet.isLoading}
          isError={sheet.isError}
          isEmpty={!sheet.isLoading && visible.length === 0}
          emptyText="Ro'yxat bo'sh"
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-gray-200 bg-white text-left text-gray-500 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="p-3">Nomi</th>
                <th className="p-3 text-right">Hozirgi</th>
                <th className="p-3 text-right">Yangi qoldiq</th>
                <th className="p-3 text-right">Farq</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const draft = drafts[row.id] ?? '';
                const issue = rowIssue(row.current, draft, rules);
                const filled = draft.trim() !== '' && draft.trim() !== '-' && !issue;
                const diff = filled ? Number(draft) - Number(row.current) : 0;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="p-3">
                      <div>{row.name}</div>
                      {row.code && <div className="text-xs text-gray-400">{row.code}</div>}
                    </td>
                    <td className="p-3 text-right">{fmt(row.current)}</td>
                    <td className="p-3 text-right">
                      <input
                        className={`field ml-auto w-36 text-right ${issue ? 'border-danger' : ''}`}
                        inputMode="decimal"
                        data-opening-target
                        aria-label={`${row.name} — yangi qoldiq`}
                        aria-invalid={issue !== null}
                        placeholder="—"
                        value={draft}
                        onChange={(e) =>
                          setDrafts({ ...drafts, [row.id]: e.target.value.replace(',', '.') })
                        }
                        onKeyDown={focusNext}
                      />
                      {issue && <div className="mt-1 text-xs text-danger">{issue}</div>}
                    </td>
                    <td className={`p-3 text-right ${diffTone(diff)}`}>
                      {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
      </div>

      {mutation.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(mutation.error)}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          className="field max-w-xs"
          placeholder="Izoh (ixtiyoriy)"
          aria-label="Izoh"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <span className="text-sm text-gray-500">O'zgargan: {changes.length} ta</span>
        <button
          className="btn-brand px-6"
          disabled={changes.length === 0 || blocked || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Saqlash
        </button>
      </div>
    </div>
  );
}
