import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { extractApiError } from '@/shared/api/client';

interface Props {
  isLoading: boolean;
  isError: boolean;
  /** Xato obyekti berilsa — aniq sabab ko'rsatiladi (masalan "Serverga ulanib bo'lmadi"). */
  error?: unknown;
  isEmpty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  loadingComponent?: ReactNode;
  children: ReactNode;
}

export function DataState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyText,
  onRetry,
  loadingComponent,
  children,
}: Props): ReactElement {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div aria-live="polite" aria-busy="true">
        {loadingComponent ?? <p className="p-4 text-gray-500">{t('common.loading')}</p>}
      </div>
    );
  }
  if (isError) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-xl border border-danger/20 bg-danger/5 p-8 text-center text-danger"
      >
        <p className="mb-3 font-medium">
          {error != null ? extractApiError(error) : t('common.error')}
        </p>
        {onRetry && (
          <button
            className="btn bg-danger px-4 text-white hover:brightness-110"
            onClick={onRetry}
          >
            {t('common.retry')}
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div role="status" aria-live="polite" className="p-8 text-center text-gray-400">
        <p>{emptyText ?? 'Ma’lumot yo’q'}</p>
      </div>
    );
  }
  return <>{children}</>;
}
