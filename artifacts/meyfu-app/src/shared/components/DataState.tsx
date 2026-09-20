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
  /** Keyingi qadam: masalan "Yangi mijoz qo'shish uchun + tugmasini bosing." */
  emptyHint?: string;
  children: ReactNode;
}

export function DataState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyText,
  emptyHint,
  children,
}: Props): ReactElement {
  const { t } = useTranslation();
  if (isLoading) return <p className="p-4 text-gray-500">{t('common.loading')}</p>;
  if (isError)
    return (
      <p className="p-4 text-danger">
        {error != null ? extractApiError(error) : t('common.error')}
      </p>
    );
  if (isEmpty)
    return (
      <div className="p-8 text-center text-gray-400">
        <p>{emptyText ?? "Ma'lumot yo'q"}</p>
        {emptyHint && <p className="mt-1 text-xs">{emptyHint}</p>}
      </div>
    );
  return <>{children}</>;
}
