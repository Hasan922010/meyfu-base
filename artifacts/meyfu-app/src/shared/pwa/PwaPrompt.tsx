import { X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

export function PwaPrompt(): ReactElement | null {
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const onOffline = () => setOfflineReady(true);
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, []);

  if (!offlineReady) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Ilova oflayn ishlashga tayyor</p>
          <p className="mt-1 text-xs text-gray-500">Endi internetsiz ham ishlay olasiz.</p>
        </div>
        <button
          onClick={() => setOfflineReady(false)}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Yopish"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
