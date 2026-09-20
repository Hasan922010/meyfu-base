import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { notificationsApi } from '@/shared/api/notifications';
import { dateShort } from '@/shared/lib/format';

export function NotificationBell(): ReactElement {
  const qc = useQueryClient();
  const [open, setOpen] = useState<boolean>(false);

  const count = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000,
  });
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list({ page_size: 20 }),
    enabled: open,
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = count.data?.count ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="Bildirishnomalar"
      >
        <Bell size={20} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-gray-800">
              <span className="text-sm font-semibold">Bildirishnomalar</span>
              <button
                className="text-xs text-brand hover:underline"
                onClick={() => markAll.mutate()}
              >
                Hammasini o'qildi
              </button>
            </div>
            <ul>
              {list.data?.results.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-gray-50 p-3 text-sm last:border-0 dark:border-gray-800 ${
                    n.is_read ? '' : 'bg-brand/5'
                  }`}
                >
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-gray-500">{n.body}</div>}
                  <div className="mt-0.5 text-[10px] text-gray-400">
                    {dateShort(n.created_at)}
                  </div>
                </li>
              ))}
              {(list.data?.results.length ?? 0) === 0 && (
                <li className="p-6 text-center text-sm text-gray-400">
                  Bildirishnoma yo'q
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
