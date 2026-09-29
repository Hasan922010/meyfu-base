import { useState, type ReactElement } from 'react';

import { staffApi } from '@/shared/api/users';
import { useAuthStore } from '@/shared/store/authStore';

import { SimpleCrud, type FieldSpec, type SelectOption } from './SimpleCrud';

type TabId =
  | 'warehouses'
  | 'suppliers'
  | 'expense-categories'
  | 'categories'
  | 'brands'
  | 'units';

interface TabDef {
  id: TabId;
  label: string;
  title: string;
  fields: FieldSpec[];
  columns: string[];
  columnLabels?: Record<string, string>;
}

const MANAGER_ROLES = new Set(['WAREHOUSE', 'MANAGER', 'SUPER_ADMIN']);

/** Ombor mas'uli bo'la oladigan faol xodimlar */
async function loadManagers(): Promise<SelectOption[]> {
  const page = await staffApi.list({ is_active: true, page_size: 200 });
  return page.results
    .filter((u) => MANAGER_ROLES.has(u.role))
    .map((u) => ({ value: u.id, label: u.full_name }));
}

const TABS: TabDef[] = [
  {
    id: 'warehouses',
    label: 'Omborlar',
    title: 'Ombor',
    fields: [
      { name: 'name', label: 'Nomi', required: true },
      { name: 'address', label: 'Manzil' },
      { name: 'phone', label: 'Telefon', placeholder: '+998 90 123 45 67' },
      {
        name: 'manager',
        label: "Mas'ul xodim",
        type: 'select',
        options: { queryKey: ['staff', 'warehouse-managers'], load: loadManagers },
      },
      { name: 'is_branch', label: 'Filial (asosiy ombor emas)', type: 'checkbox' },
      { name: 'is_active', label: 'Faol', type: 'checkbox', defaultChecked: true },
    ],
    columns: ['name', 'address', 'is_branch', 'manager_name', 'is_active'],
    columnLabels: { is_branch: 'Filial', manager_name: "Mas'ul" },
  },
  {
    id: 'suppliers',
    label: 'Yetkazib beruvchilar',
    title: 'Yetkazib beruvchi',
    fields: [
      { name: 'name', label: 'Nomi', required: true },
      { name: 'phone', label: 'Telefon' },
      { name: 'inn', label: 'INN / STIR' },
      { name: 'address', label: 'Manzil' },
      { name: 'is_active', label: 'Faol', type: 'checkbox', defaultChecked: true },
    ],
    columns: ['name', 'phone', 'inn', 'is_active'],
  },
  {
    id: 'expense-categories',
    label: 'Xarajat kategoriyalari',
    title: 'Xarajat kategoriyasi',
    fields: [
      { name: 'name', label: 'Nomi', required: true },
      { name: 'icon', label: 'Ikona (emoji)', placeholder: '⛽' },
      { name: 'daily_limit', label: 'Kunlik limit', type: 'number' },
      { name: 'requires_receipt', label: 'Chek majburiy', type: 'checkbox' },
    ],
    columns: ['icon', 'name', 'daily_limit', 'requires_receipt'],
  },
  {
    id: 'categories',
    label: 'Mahsulot kategoriyalari',
    title: 'Kategoriya',
    fields: [{ name: 'name', label: 'Nomi', required: true }],
    columns: ['name'],
  },
  {
    id: 'brands',
    label: 'Brendlar',
    title: 'Brend',
    fields: [{ name: 'name', label: 'Nomi', required: true }],
    columns: ['name'],
  },
  {
    id: 'units',
    label: "O'lchov birliklari",
    title: 'Birlik',
    fields: [
      { name: 'name', label: 'Nomi', required: true },
      { name: 'short_name', label: 'Qisqa', required: true, placeholder: 'dona' },
    ],
    columns: ['name', 'short_name'],
  },
];

export function RefDataPage(): ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'MANAGER' || role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<TabId>('warehouses');
  const active = TABS.find((t) => t.id === tab) ?? TABS[0]!;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ma'lumotnomalar</h1>
      <p className="text-sm text-gray-500">
        Ombor, yetkazib beruvchi, kategoriya va boshqa lug'atlar. Yaratish/tahrirlash
        {' '}— menejer va admin uchun.
      </p>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand text-brand' : 'text-gray-500'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <SimpleCrud
        key={active.id}
        path={active.id}
        title={active.title}
        fields={active.fields}
        columns={active.columns}
        columnLabels={active.columnLabels}
        canWrite={canWrite}
      />
    </div>
  );
}
