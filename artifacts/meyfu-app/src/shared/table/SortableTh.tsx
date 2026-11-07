import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { SortState } from './sort';

interface Props {
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

/** Saralanadigan ustun sarlavhasi: bosish — o'sish → kamayish → asl tartib. */
export function SortableTh({
  sortKey,
  sort,
  onSort,
  children,
  className = 'p-3',
  align = 'left',
}: Props): ReactElement {
  const { t } = useTranslation();
  const active = sort?.key === sortKey ? sort.dir : null;
  const ariaSort = active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none';
  const Icon = active === 'asc' ? ChevronUp : active === 'desc' ? ChevronDown : ChevronsUpDown;
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full items-center gap-1 ${justify} font-inherit hover:text-gray-900 dark:hover:text-gray-100 ${
          active ? 'text-gray-900 dark:text-gray-100' : ''
        }`}
        title={t('table.sortHint')}
      >
        <span>{children}</span>
        <Icon size={14} aria-hidden className={active ? '' : 'opacity-40'} />
      </button>
    </th>
  );
}
