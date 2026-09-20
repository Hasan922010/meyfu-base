import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

// Audit FE-001: ErrorBoundary tomonidan ko'rsatiladigan fallback UI.

export function ErrorFallback({
  error,
  variant,
  onRetry,
}: {
  error: Error;
  variant: 'screen' | 'page';
  onRetry: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const wrap =
    variant === 'screen'
      ? 'flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center'
      : 'flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger/5 p-6 text-center';

  return (
    <div className={wrap} role="alert">
      <p className="text-4xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="text-lg font-semibold">
        {t('errorBoundary.title', 'Nimadir noto‘g‘ri ketdi')}
      </h1>
      <p className="max-w-sm text-sm text-gray-500">
        {t(
          'errorBoundary.body',
          'Sahifani ochishda xatolik yuz berdi. Qayta urinib ko‘ring.',
        )}
      </p>
      {import.meta.env.DEV && (
        <pre className="max-w-full overflow-x-auto rounded bg-gray-100 p-2 text-left text-xs text-danger dark:bg-gray-800">
          {error.message}
        </pre>
      )}
      <div className="flex gap-2 pt-1">
        <button className="btn-brand px-4" onClick={onRetry}>
          {t('errorBoundary.retry', 'Qayta urinish')}
        </button>
        <button className="btn px-4" onClick={() => window.location.assign('/')}>
          {t('errorBoundary.home', 'Bosh sahifa')}
        </button>
      </div>
    </div>
  );
}
