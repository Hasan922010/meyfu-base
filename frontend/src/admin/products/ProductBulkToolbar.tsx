import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Trash2, X, XCircle } from 'lucide-react';
import type { ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';

interface Props {
  selectedIds: Set<string>;
  onClear: () => void;
}

export function ProductBulkToolbar({ selectedIds, onClear }: Props): ReactElement | null {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (action: 'activate' | 'deactivate' | 'delete') =>
      catalogApi.bulkActions({ ids: Array.from(selectedIds), action }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      onClear();
    },
  });

  if (selectedIds.size === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex w-max max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-xl dark:border-slate-200 dark:bg-white dark:text-slate-900">
      <div className="flex items-center gap-2 whitespace-nowrap border-r border-slate-700 px-2 text-sm font-medium dark:border-slate-200">
        <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand text-xs text-white">
          {selectedIds.size}
        </span>
        tanlandi
      </div>

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
        <button
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-slate-800 disabled:opacity-50 dark:text-emerald-600 dark:hover:bg-slate-100"
          onClick={() => mutation.mutate('activate')}
          disabled={mutation.isPending}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="hidden sm:inline">Faollashtirish</span>
        </button>

        <button
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50 dark:text-slate-600 dark:hover:bg-slate-100"
          onClick={() => mutation.mutate('deactivate')}
          disabled={mutation.isPending}
        >
          <XCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Nofaol qilish</span>
        </button>

        <button
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-slate-800 disabled:opacity-50 dark:text-red-600 dark:hover:bg-slate-100"
          onClick={() => {
            if (window.confirm('Rostdan ham o‘chirmoqchimisiz?')) {
              mutation.mutate('delete');
            }
          }}
          disabled={mutation.isPending}
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">O‘chirish</span>
        </button>
      </div>

      <button
        onClick={onClear}
        className="ml-auto flex shrink-0 items-center justify-center rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white dark:text-slate-500 dark:hover:bg-slate-100 dark:hover:text-slate-900"
        aria-label="Bekor qilish"
      >
        <X className="h-4 w-4" />
      </button>

      {mutation.isError && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white shadow-lg">
          {extractApiError(mutation.error)}
        </div>
      )}
    </div>
  );
}

