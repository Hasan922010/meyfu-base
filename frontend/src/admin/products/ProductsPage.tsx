import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { useAuthStore } from '@/shared/store/authStore';
import { money } from '@/shared/lib/format';
import type { Product } from '@/shared/types/catalog';

import { ProductForm } from './ProductForm';

export function ProductsPage(): ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'MANAGER' || role === 'SUPER_ADMIN';

  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const query = useQuery({
    queryKey: ['products', { search, page }],
    queryFn: () =>
      catalogApi.products({ search: search || undefined, page, page_size: 20 }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.results ?? [];

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

      <input
        className="field max-w-sm"
        placeholder="Nomi / SKU / shtrix-kod bo'yicha qidirish"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Mahsulot topilmadi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3 w-12" />
                <th className="p-3">Nomi</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Kategoriya</th>
                <th className="p-3 text-right">Chakana</th>
                <th className="p-3 text-right">Min. narx</th>
                <th className="p-3">Holat</th>
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
            onClick={() => setPage((p) => p - 1)}
          >
            ‹
          </button>
          <span>
            {page} / {query.data.pages}
          </span>
          <button
            className="btn px-3"
            disabled={page >= query.data.pages}
            onClick={() => setPage((p) => p + 1)}
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
