import { Compass } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/** 404 — mavjud bo'lmagan sahifa. */
export function NotFound(): ReactElement {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center text-gray-500">
      <Compass size={40} aria-hidden />
      <h1 className="text-xl font-semibold">{t('notFound.title')}</h1>
      <p className="text-sm">{t('notFound.body')}</p>
      <Link
        to="/"
        className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
      >
        {t('notFound.home')}
      </Link>
    </div>
  );
}
