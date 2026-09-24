import { Search } from 'lucide-react';
import { useId, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export type TableFilter =
  | { key: string; label: string; type?: 'select'; options: Array<{ value: string; label: string }> }
  | { key: string; label: string; type: 'date' };

interface Props {
  search?: string;
  onSearch?: (q: string) => void;
  filters?: TableFilter[];
  values?: Record<string, string>;
  onFilter?: (key: string, value: string) => void;
  onReset?: () => void;
  /** Ko'rsatilayotgan yozuvlar soni */
  count?: number | undefined;
}

/** Jadval tepasidagi panel: qidiruv + asosiy filtrlar + tozalash. */
export function TableToolbar({
  search,
  onSearch,
  filters = [],
  values = {},
  onFilter,
  onReset,
  count,
}: Props): ReactElement {
  const { t } = useTranslation();
  const idPrefix = useId();
  const dirty = Boolean(search) || Object.values(values).some((v) => v !== '');

  return (
    <div className="flex flex-wrap items-end gap-2">
      {onSearch && (
        <div className="relative min-w-[12rem] flex-1">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            className="field pl-9"
            placeholder={t('table.search')}
            aria-label={t('table.search')}
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      )}

      {filters.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        return (
          <div key={f.key} className="space-y-0.5">
            <label htmlFor={id} className="block text-xs text-gray-500">
              {f.label}
            </label>
            {f.type === 'date' ? (
              <input
                id={id}
                type="date"
                className="field w-auto"
                value={values[f.key] ?? ''}
                onChange={(e) => onFilter?.(f.key, e.target.value)}
              />
            ) : (
              <select
                id={id}
                className="field w-auto"
                value={values[f.key] ?? ''}
                onChange={(e) => onFilter?.(f.key, e.target.value)}
              >
                <option value="">{t('table.all')}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}

      {onReset && dirty && (
        <button type="button" className="btn px-3" onClick={onReset}>
          {t('table.clear')}
        </button>
      )}

      {count != null && (
        <span className="ml-auto self-center text-sm text-gray-500">
          {t('table.count', { count })}
        </span>
      )}
    </div>
  );
}
