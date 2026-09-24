import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/locales/i18n';

import { SortableTh } from './SortableTh';
import { TableToolbar } from './TableToolbar';
import { useClientTable } from './useClientTable';
import { useServerTable } from './useServerTable';

interface Row {
  id: string;
  name: string;
  total: string;
  status: 'PAID' | 'DEBT';
}

const ROWS: Row[] = [
  { id: '1', name: 'Oila market', total: '9000.00', status: 'PAID' },
  { id: '2', name: "Baraka do'koni", total: '10000.00', status: 'DEBT' },
  { id: '3', name: 'Yangi hayot', total: '500.00', status: 'PAID' },
];

function Demo(): ReactElement {
  const t = useClientTable<Row>({
    rows: ROWS,
    sortBy: { name: (r) => r.name, total: (r) => r.total },
    searchIn: (r) => [r.name],
    filters: { status: (r, v) => r.status === v },
  });
  return (
    <>
      <TableToolbar
        search={t.search}
        onSearch={t.setSearch}
        filters={[
          { key: 'status', label: 'Holat', options: [{ value: 'PAID', label: "To'langan" }, { value: 'DEBT', label: 'Qarz' }] },
        ]}
        values={t.filterValues}
        onFilter={t.setFilter}
        onReset={t.reset}
        count={t.rows.length}
      />
      <table>
        <thead>
          <tr>
            <SortableTh sortKey="name" sort={t.sort} onSort={t.onSort}>Mijoz</SortableTh>
            <SortableTh sortKey="total" sort={t.sort} onSort={t.onSort}>Summa</SortableTh>
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function names(): string[] {
  const body = screen.getAllByRole('rowgroup')[1];
  return within(body as HTMLElement)
    .getAllByRole('row')
    .map((tr) => tr.firstChild?.textContent ?? '');
}

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('Jadval: saralash, qidiruv, filtr', () => {
  it('ustun sarlavhasiga bosish: o‘sish → kamayish → asl tartib', () => {
    render(<Demo />);
    const th = screen.getByRole('columnheader', { name: /Summa/ });

    fireEvent.click(within(th).getByRole('button'));
    expect(th).toHaveAttribute('aria-sort', 'ascending');
    expect(names()).toEqual(['Yangi hayot', 'Oila market', "Baraka do'koni"]);

    fireEvent.click(within(th).getByRole('button'));
    expect(th).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(["Baraka do'koni", 'Oila market', 'Yangi hayot']);

    fireEvent.click(within(th).getByRole('button'));
    expect(th).toHaveAttribute('aria-sort', 'none');
    expect(names()).toEqual(['Oila market', "Baraka do'koni", 'Yangi hayot']);
  });

  it('qidiruv va filtr ro‘yxatni toraytiradi, "Tozalash" qaytaradi', () => {
    render(<Demo />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'oila' } });
    expect(names()).toEqual(['Oila market']);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Holat'), { target: { value: 'DEBT' } });
    expect(names()).toEqual(["Baraka do'koni"]);
    expect(screen.getByText('1 ta')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tozalash' }));
    expect(names()).toHaveLength(3);
  });
});

describe('useServerTable', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saralash, qidiruv (kechiktirilgan) va filtrlardan DRF parametrlarini yasaydi, sahifani 1 ga qaytaradi', () => {
    const { result } = renderHook(() => useServerTable({ initialSort: { key: 'date', dir: 'desc' } }));
    expect(result.current.params).toEqual({ ordering: '-date', page: 1 });

    act(() => result.current.setPage(3));
    act(() => result.current.onSort('total_amount'));
    expect(result.current.params).toEqual({ ordering: 'total_amount', page: 1 });

    act(() => result.current.setSearch('baraka'));
    expect(result.current.params.search).toBeUndefined();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.params.search).toBe('baraka');

    act(() => result.current.setFilter('status', 'COMPLETED'));
    expect(result.current.params).toMatchObject({ status: 'COMPLETED', page: 1 });

    act(() => result.current.setFilter('status', ''));
    expect(result.current.params).not.toHaveProperty('status');
  });
});
