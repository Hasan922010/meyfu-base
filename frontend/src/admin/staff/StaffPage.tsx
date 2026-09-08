import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { staffApi } from '@/shared/api/users';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { useAuthStore } from '@/shared/store/authStore';
import type { Role, User } from '@/shared/types/api';

import { StaffForm } from './StaffForm';

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super admin',
  MANAGER: 'Menejer',
  WAREHOUSE: 'Omborchi',
  DISTRIBUTOR: 'Tarqatuvchi',
  ACCOUNTANT: 'Buxgalter',
};

export function StaffPage(): ReactElement {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const canWrite = me?.role === 'SUPER_ADMIN';

  const [role, setRole] = useState<string>('');
  const [active, setActive] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const query = useQuery({
    queryKey: ['staff', { role, active, search, page }],
    queryFn: () =>
      staffApi.list({
        role: role || undefined,
        is_active: active || undefined,
        search: search || undefined,
        page,
        page_size: 25,
      }),
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: (id: string) => staffApi.toggleActive(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Xodimlar</h1>
        {canWrite && (
          <button className="btn-brand px-4" onClick={() => setCreating(true)}>
            + Yangi xodim
          </button>
        )}
      </div>

      {!canWrite && (
        <p className="text-sm text-gray-500">
          Xodim qo'shish/tahrirlash faqat Super admin uchun.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          className="field max-w-xs"
          placeholder="F.I.SH. / telefon"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="field max-w-[170px]"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Barcha rollar</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <select
          className="field max-w-[150px]"
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Faol + bloklangan</option>
          <option value="true">Faqat faol</option>
          <option value="false">Faqat bloklangan</option>
        </select>
      </div>

      {toggle.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(toggle.error)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Xodim topilmadi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">F.I.SH.</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Komissiya</th>
                <th className="p-3">Holat</th>
                {canWrite && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-medium">{u.full_name}</td>
                  <td className="p-3 font-mono text-xs">{u.phone}</td>
                  <td className="p-3">{ROLE_LABEL[u.role]}</td>
                  <td className="p-3">
                    {u.distributor_profile
                      ? `${u.distributor_profile.commission_percent}%`
                      : '—'}
                  </td>
                  <td className={`p-3 ${u.is_active ? 'text-success' : 'text-danger'}`}>
                    {u.is_active ? 'Faol' : 'Bloklangan'}
                  </td>
                  {canWrite && (
                    <td className="p-3 text-right">
                      <span className="flex justify-end gap-3">
                        <button
                          className="text-brand hover:underline"
                          onClick={() => setEditing(u)}
                        >
                          Tahrir
                        </button>
                        {u.id !== me?.id && (
                          <button
                            className={
                              u.is_active
                                ? 'text-danger hover:underline'
                                : 'text-success hover:underline'
                            }
                            disabled={toggle.isPending}
                            onClick={() => toggle.mutate(u.id)}
                          >
                            {u.is_active ? 'Bloklash' : 'Faollashtirish'}
                          </button>
                        )}
                      </span>
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
        title={editing ? 'Xodimni tahrirlash' : 'Yangi xodim'}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      >
        <StaffForm
          staff={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>
    </div>
  );
}
