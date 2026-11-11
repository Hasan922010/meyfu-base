import { X } from 'lucide-react';
import { useCallback, useState, type PropsWithChildren, type ReactElement } from 'react';

import { ToastContext, type Toast, type ToastKind } from '@/shared/lib/toast';

const KIND_CLASS: Record<ToastKind, string> = {
  info: 'border-brand bg-white dark:bg-gray-900',
  success: 'border-success bg-white dark:bg-gray-900',
  warning: 'border-pending bg-white dark:bg-gray-900',
  danger: 'border-danger bg-white dark:bg-gray-900',
};

export function ToastProvider({ children }: PropsWithChildren): ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 6000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] mx-auto flex max-w-sm flex-col gap-2 px-3"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex items-start justify-between gap-2 rounded-xl border-l-4 p-3 text-sm shadow-lg ${KIND_CLASS[t.kind]}`}
          >
            <div>
              <div className="font-semibold">{t.title}</div>
              {t.body && <div className="mt-0.5 text-gray-500">{t.body}</div>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand dark:hover:text-gray-300"
              aria-label="Yopish"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
