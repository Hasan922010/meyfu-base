import { Minus, Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import type { CachedVanStock } from '@/offline/db';
import { money } from '@/shared/lib/format';

import {
  addToCart,
  remainingFor,
  setLinePrice,
  setLineQuantity,
  type AddResult,
  type CartLine,
} from './lib/cart';

// UX audit M4: tovarlar mijoz tanlangach darhol ko'rinadi, qatorga bosish = +1,
// miqdor va narxni ustiga bosib yozish mumkin. Naqd tugmasi sahifa pastida.

interface Props {
  van: CachedVanStock[];
  cart: CartLine[];
  /** Standart (optom) narx */
  priceOf: (productId: string) => number;
  thumbOf: (productId: string) => string | null | undefined;
  onChange: (cart: CartLine[], notice: string) => void;
}

type Editing = { product: string; field: 'qty' | 'price' } | null;

export function SaleProductList({ van, cart, priceOf, thumbOf, onChange }: Props): ReactElement {
  const [search, setSearch] = useState<string>('');
  const [editing, setEditing] = useState<Editing>(null);

  const rows = van.filter(
    (v) => v.quantity > 0 && v.product_name.toLowerCase().includes(search.toLowerCase()),
  );

  function emit(res: AddResult, unit: string): void {
    onChange(res.cart, res.clampedTo != null ? `Mashinada faqat ${res.clampedTo} ${unit} bor` : '');
  }

  function lineFor(v: CachedVanStock, quantity: number): CartLine {
    const inCart = cart.find((l) => l.product === v.product);
    return {
      product: v.product,
      product_name: v.product_name,
      quantity,
      price: inCart?.price ?? priceOf(v.product),
      max: v.quantity,
    };
  }

  function commit(v: CachedVanStock, field: 'qty' | 'price', raw: string): void {
    setEditing(null);
    const value = Number(raw);
    if (field === 'price') {
      onChange(setLinePrice(cart, v.product, value), '');
      return;
    }
    emit(setLineQuantity(cart, lineFor(v, value), v.quantity), v.unit);
  }

  return (
    <div className="space-y-2">
      <input
        className="field"
        placeholder="Tovar qidirish…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {rows.length === 0 && (
        <p className="p-4 text-center text-sm text-gray-400">
          {van.length === 0 ? "Mashinada tovar yo'q — avval yuklamani tasdiqlang" : 'Topilmadi'}
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((v) => (
          <ProductRow
            key={v.product}
            stock={v}
            line={cart.find((l) => l.product === v.product)}
            remaining={remainingFor(v.quantity, cart, v.product)}
            defaultPrice={priceOf(v.product)}
            thumb={thumbOf(v.product)}
            editing={editing?.product === v.product ? editing.field : null}
            onAdd={() => emit(addToCart(cart, lineFor(v, 1), v.quantity), v.unit)}
            onRemoveOne={(q) => emit(setLineQuantity(cart, lineFor(v, q - 1), v.quantity), v.unit)}
            onEdit={(field) => setEditing({ product: v.product, field })}
            onCommit={(field, raw) => commit(v, field, raw)}
          />
        ))}
      </ul>
    </div>
  );
}

interface RowProps {
  stock: CachedVanStock;
  line: CartLine | undefined;
  remaining: number;
  defaultPrice: number;
  thumb: string | null | undefined;
  editing: 'qty' | 'price' | null;
  onAdd: () => void;
  onRemoveOne: (currentQty: number) => void;
  onEdit: (field: 'qty' | 'price') => void;
  onCommit: (field: 'qty' | 'price', raw: string) => void;
}

function ProductRow({
  stock,
  line,
  remaining,
  defaultPrice,
  thumb,
  editing,
  onAdd,
  onRemoveOne,
  onEdit,
  onCommit,
}: RowProps): ReactElement {
  const name = stock.product_name;
  const price = line?.price ?? defaultPrice;
  const selected = line != null;

  return (
    <li
      className={`flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm dark:bg-gray-900 ${
        selected ? 'ring-2 ring-brand' : ''
      }`}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60"
        onClick={onAdd}
        disabled={remaining === 0}
        aria-label={`${name} — 1 ta qo'shish`}
      >
        {thumb ? (
          <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded bg-gray-100 dark:bg-gray-800" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block text-xs text-gray-500">
            {remaining} {stock.unit} qoldi
          </span>
        </span>
      </button>

      {editing === 'price' ? (
        <InlineNumber label={`${name} narxi`} initial={price} onCommit={(raw) => onCommit('price', raw)} />
      ) : (
        <button
          className={`shrink-0 rounded px-1 text-xs text-gray-600 dark:text-gray-300 ${
            selected ? 'underline decoration-dotted' : ''
          }`}
          onClick={() => onEdit('price')}
          disabled={!selected}
          aria-label={`${name} narxini o‘zgartirish`}
        >
          {money(price)}
        </button>
      )}

      {selected && (
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
          onClick={() => onRemoveOne(line.quantity)}
          aria-label={`${name} — kamaytirish`}
        >
          <Minus size={18} aria-hidden />
        </button>
      )}
      {selected &&
        (editing === 'qty' ? (
          <InlineNumber label={`${name} miqdori`} initial={line.quantity} onCommit={(raw) => onCommit('qty', raw)} />
        ) : (
          <button
            className="min-w-[2.5rem] shrink-0 text-center text-lg font-bold"
            onClick={() => onEdit('qty')}
            aria-label={`${name} miqdorini yozish`}
          >
            {line.quantity}
          </button>
        ))}
      <button
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand disabled:opacity-40"
        onClick={onAdd}
        disabled={remaining === 0}
        aria-label={`${name} — ko'paytirish`}
      >
        <Plus size={18} aria-hidden />
      </button>
    </li>
  );
}

function InlineNumber({
  label,
  initial,
  onCommit,
}: {
  label: string;
  initial: number;
  onCommit: (raw: string) => void;
}): ReactElement {
  const [value, setValue] = useState<string>(String(initial));
  return (
    <input
      className="field w-20 shrink-0 px-2 py-1 text-center"
      type="number"
      inputMode="numeric"
      min="0"
      aria-label={label}
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value);
      }}
    />
  );
}
