import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  children: ReactNode;
}

export function DataState({
  isLoading,
  isError,
  isEmpty,
  emptyText,
  children,
}: Props): ReactElement {
  const { t } = useTranslation();
  if (isLoading) return <p className="p-4 text-gray-500">{t('common.loading')}</p>;
  if (isError) return <p className="p-4 text-danger">{t('common.error')}</p>;
  if (isEmpty)
    return (
      <p className="p-8 text-center text-gray-400">
        {emptyText ?? 'Ma’lumot yo’q'}
      </p>
    );
  return <>{children}</>;
}
