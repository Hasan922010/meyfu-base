import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { refResource, type RefRow } from '@/shared/api/refdata';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';

export interface FieldSpec {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  /** Yangi yozuv uchun boshlang'ich qiymat (checkbox uchun) */
  defaultChecked?: boolean;
}

interface Props {
  /** API yo'li (masalan "warehouses", "suppliers", "expense-categories") */
  path: string;
  title: string;
  fields: FieldSpec[];
  /** Jadvalda ko'rsatiladigan ustunlar (fields nomlari) */
  columns: string[];
  canWrite: boolean;
}

export function SimpleCrud({
  path,
  title,
  fields,
  columns,
  canWrite,
}: Props): ReactElement {
  const qc = useQueryClient();
  const resource = refResource(path);
  const key = ['refdata', path];

  const [editing, setEditing] = useState<RefRow | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const query = useQuery({ queryKey: key, queryFn: () => resource.list() });

  const del = useMutation({
    mutationFn: (id: string) => resource.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  const rows = query.data?.results ?? [];
  const labelOf = (n: string): string =>
    fields.find((f) => f.name === n)?.label ?? n;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {canWrite && (
          <button className="btn-brand px-3" onClick={() => setCreating(true)}>
            + Qo'shish
          </button>
        )}
      </div>

      {del.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(del.error)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Yozuv yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="p-3">
                    {labelOf(c)}
                  </th>
                ))}
                {canWrite && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  {columns.map((c) => (
                    <td key={c} className="p-3">
                      {typeof r[c] === 'boolean'
                        ? r[c]
                          ? 'Ha'
                          : "Yo'q"
                        : (r[c] ?? '—')}
                    </td>
                  ))}
                  {canWrite && (
                    <td className="p-3 text-right">
                      <span className="flex justify-end gap-3">
                        <button
                          className="text-brand hover:underline"
                          onClick={() => setEditing(r)}
                        >
                          Tahrir
                        </button>
                        <button
                          className="text-danger hover:underline"
                          disabled={del.isPending}
                          onClick={() => {
                            if (window.confirm(`"${r.name ?? r.id}" o'chirilsinmi?`)) {
                              del.mutate(r.id);
                            }
                          }}
                        >
                          O'chirish
                        </button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal
        open={creating || editing !== null}
        title={editing ? `${title} — tahrir` : `Yangi: ${title}`}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      >
        <CrudForm
          path={path}
          fields={fields}
          row={editing}
          onDone={() => {
            void qc.invalidateQueries({ queryKey: key });
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>
    </div>
  );
}

function CrudForm({
  path,
  fields,
  row,
  onDone,
}: {
  path: string;
  fields: FieldSpec[];
  row: RefRow | null;
  onDone: () => void;
}): ReactElement {
  const resource = refResource(path);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of fields) {
      const v = row?.[f.name];
      if (f.type === 'checkbox') {
        init[f.name] = row ? Boolean(v) : Boolean(f.defaultChecked);
      } else {
        init[f.name] = v == null ? '' : String(v);
      }
    }
    return init;
  });

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, string | boolean | number> = {};
      for (const f of fields) {
        const v = values[f.name] ?? '';
        if (f.type === 'number') body[f.name] = v === '' ? 0 : Number(v);
        else body[f.name] = v;
      }
      return row ? resource.update(row.id, body) : resource.create(body);
    },
    onSuccess: onDone,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-3"
    >
      {fields.map((f) =>
        f.type === 'checkbox' ? (
          <label key={f.name} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(values[f.name])}
              onChange={(e) =>
                setValues((s) => ({ ...s, [f.name]: e.target.checked }))
              }
            />
            <span className="text-sm">{f.label}</span>
          </label>
        ) : (
          <label key={f.name} className="block space-y-1">
            <span className="text-sm font-medium">
              {f.label}
              {f.required && ' *'}
            </span>
            <input
              className="field"
              type={f.type === 'number' ? 'number' : 'text'}
              step={f.type === 'number' ? '0.01' : undefined}
              placeholder={f.placeholder}
              required={f.required}
              value={String(values[f.name] ?? '')}
              onChange={(e) =>
                setValues((s) => ({ ...s, [f.name]: e.target.value }))
              }
            />
          </label>
        ),
      )}

      {mutation.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(mutation.error)}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="btn px-4">
          Bekor
        </button>
        <button type="submit" className="btn-brand px-6" disabled={mutation.isPending}>
          Saqlash
        </button>
      </div>
    </form>
  );
}
