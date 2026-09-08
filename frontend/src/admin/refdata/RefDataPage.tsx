import { useState, type ReactElement } from 'react';

import { useAuthStore } from '@/shared/store/authStore';

import { SimpleCrud, type FieldSpec } from './SimpleCrud';

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
}

const TABS: TabDef[] = [
  {
    id: 'warehouses',
    label: 'Omborlar',
    title: 'Ombor',
    fields: [
      { name: 'name', label: 'Nomi', required: true },
      { name: 'address', label: 'Manzil' },
      { name: 'is_active', label: 'Faol', type: 'checkbox', defaultChecked: true },
    ],
    columns: ['name', 'address', 'is_active'],
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
        canWrite={canWrite}
      />
    </div>
  );
}
