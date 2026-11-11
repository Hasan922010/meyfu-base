import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

interface Props {
  field: string;
  currentOrdering: string;
  onSort: (field: string) => void;
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function SortableHeader({
  field,
  currentOrdering,
  onSort,
  children,
  align = 'left',
  className = '',
}: Props): ReactElement {
  const isSorted = currentOrdering === field || currentOrdering === `-${field}`;
  const isDesc = currentOrdering === `-${field}`;

  return (
    <th
      className={`cursor-pointer p-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
      onClick={() => onSort(field)}
      role="columnheader"
      aria-sort={isSorted ? (isDesc ? 'descending' : 'ascending') : 'none'}
    >
      <div
        className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        <span>{children}</span>
        <span className="flex-shrink-0 text-slate-400">
          {isSorted ? (
            isDesc ? (
              <ArrowDown className="h-3.5 w-3.5 text-brand" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5 text-brand" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
          )}
        </span>
      </div>
    </th>
  );
}
