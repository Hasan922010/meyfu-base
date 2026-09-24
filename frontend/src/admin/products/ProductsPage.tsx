import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { useAuthStore } from '@/shared/store/authStore';
import { money } from '@/shared/lib/format';
import { SortableTh } from '@/shared/table/SortableTh';
import { TableToolbar, type TableFilter } from '@/shared/table/TableToolbar';
import { useServerTable } from '@/shared/table/useServerTable';
import type { Product } from '@/shared/types/catalog';

import { ProductForm } from './ProductForm';

export function ProductsPage(): ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'MANAGER' || role === 'SUPER_ADMIN';

  // Saralash/qidiruv/filtr serverda — barcha mahsulotlar ustida
  const table = useServerTable({ initialSort: { key: 'name', dir: 'asc' } });
  const { page, setPage } = table;
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => catalogApi.categories({ page_size: 200 }),
  });

  const query = useQuery({
    queryKey: ['products', table.params],
    queryFn: () => catalogApi.products({ ...table.params, page_size: 20 }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.results ?? [];
  const th = { sort: table.sort, onSort: table.onSort };
  const filters: TableFilter[] = [
    {
      key: 'category',
      label: 'Kategoriya',
      options: (categories.data?.results ?? []).map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: 'is_active',
      label: 'Holat',
      options: [
        { value: 'true', label: 'Faol' },
        { value: 'false', label: 'Nofaol' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mahsulotlar</h1>
        {canWrite && (
          <button className="btn-brand px-4" onClick={() => setCreating(true)}>
            + Mahsulot
          </button>
        )}
      </div>

      <TableToolbar
        search={table.search}
        onSearch={table.setSearch}
        filters={filters}
        values={table.filterValues}
        onFilter={table.setFilter}
        onReset={table.reset}
        count={query.data?.count}
      />

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Mahsulot topilmadi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3 w-12" />
                <SortableTh sortKey="name" {...th}>Nomi</SortableTh>
                <SortableTh sortKey="sku" {...th}>SKU</SortableTh>
                <SortableTh sortKey="category__name" {...th}>Kategoriya</SortableTh>
                <SortableTh sortKey="retail_price" align="right" className="p-3 text-right" {...th}>
                  Chakana
                </SortableTh>
                <SortableTh sortKey="min_price" align="right" className="p-3 text-right" {...th}>
                  Min. narx
                </SortableTh>
                <SortableTh sortKey="is_active" {...th}>Holat</SortableTh>
                {canWrite && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-2">
                    {p.image_thumb ? (
                      <img
                        src={p.image_thumb}
                        alt=""
                        className="h-9 w-9 rounded object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded bg-gray-100 dark:bg-gray-800" />
                    )}
                  </td>
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 font-mono text-xs">{p.sku}</td>
                  <td className="p-3">{p.category_name}</td>
                  <td className="p-3 text-right">{money(p.retail_price)}</td>
                  <td className="p-3 text-right">{money(p.min_price)}</td>
                  <td className="p-3">
                    {p.is_active ? (
                      <span className="text-success">Faol</span>
                    ) : (
                      <span className="text-gray-400">Nofaol</span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="p-3 text-right">
                      <button
                        className="text-brand hover:underline"
                        onClick={() => setEditing(p)}
                      >
                        Tahrirlash
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      {query.data && query.data.pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            className="btn px-3"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ‹
          </button>
          <span>
            {page} / {query.data.pages}
          </span>
          <button
            className="btn px-3"
            disabled={page >= query.data.pages}
            onClick={() => setPage(page + 1)}
          >
            ›
          </button>
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        title={editing ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      >
        <ProductForm
          product={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>
    </div>
  );
}
