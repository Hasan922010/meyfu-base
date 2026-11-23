import { Minus, Package, Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import type { CachedVanStock } from '@/offline/db';
import { money, productUnitLabel } from '@/shared/lib/format';

import {
  addToCart,
  remainingFor,
  setLinePrice,
  setLineQuantity,
  type AddResult,
  type CartLine,
} from './lib/cart';

// UX audit M4: tovarlar mijoz tanlangach darhol ko'rinadi, qatorga bosish = +1,
// miqdor va narxni ustiga bosib yozish yoki qadoqda kiritish mumkin. Naqd tugmasi sahifa pastida.

interface Props {
  van: CachedVanStock[];
  cart: CartLine[];
  /** Standart (optom) narx */
  priceOf: (productId: string) => number;
  thumbOf: (productId: string) => string | null | undefined;
  /** Minimal narx (0 — cheklov yo'q). Pastroq narx darhol ko'rsatiladi (FE-106). */
  minPriceOf?: (productId: string) => number;
  /** Qadoq ma'lumotlari (dona/karopka ko'rsatish uchun) */
  packInfoOf?: (productId: string) => { package_type?: string | undefined; pack_quantity?: string | number | undefined } | undefined;
  onChange: (cart: CartLine[], notice: string) => void;
}

type Editing = { product: string; field: 'qty' | 'price' } | null;

export function SaleProductList({
  van,
  cart,
  priceOf,
  thumbOf,
  minPriceOf,
  packInfoOf,
  onChange,
}: Props): ReactElement {
  const [search, setSearch] = useState<string>('');
  const [editing, setEditing] = useState<Editing>(null);

  const q = search.trim().toLowerCase();
  const normQ = q.replace(/[‘'’`]/g, "'");
  const rows = van.filter((v) => {
    if (v.quantity <= 0) return false;
    if (!normQ) return true;
    const name = (v.product_name || '').toLowerCase().replace(/[‘'’`]/g, "'");
    const sku = (v.product_sku || '').toLowerCase();
    return name.includes(normQ) || sku.includes(normQ);
  });

  function emit(res: AddResult, unit: string): void {
    onChange(res.cart, res.clampedTo != null ? `Mashinada faqat ${res.clampedTo} ${unit} bor` : '');
  }

  function lineFor(v: CachedVanStock, quantity: number): CartLine {
    const inCart = cart.find((l) => l.product === v.product);
    const packInfo = packInfoOf?.(v.product);
    const unitLabel = productUnitLabel({ ...packInfo, unit: v.unit });
    return {
      product: v.product,
      product_name: v.product_name,
      quantity,
      price: inCart?.price ?? priceOf(v.product),
      package_type: packInfo?.package_type,
      pack_quantity: Number(packInfo?.pack_quantity) || 1,
      unit_name: unitLabel,
      max: v.quantity,
    };
  }

  function handleAdd(v: CachedVanStock): void {
    const packInfo = packInfoOf?.(v.product);
    const unitLabel = productUnitLabel({ ...packInfo, unit: v.unit });
    emit(addToCart(cart, lineFor(v, 1), v.quantity), unitLabel);
  }

  function handleRemoveOne(v: CachedVanStock, currentQty: number): void {
    const packInfo = packInfoOf?.(v.product);
    const unitLabel = productUnitLabel({ ...packInfo, unit: v.unit });
    emit(setLineQuantity(cart, lineFor(v, currentQty - 1), v.quantity), unitLabel);
  }

  function commit(v: CachedVanStock, field: 'qty' | 'price', raw: string): void {
    setEditing(null);
    const value = Number(raw);
    const packInfo = packInfoOf?.(v.product);
    const unitLabel = productUnitLabel({ ...packInfo, unit: v.unit });
    if (field === 'price') {
      const storedVal = Math.round(value * 100) / 100;
      const minAllowed = minPriceOf?.(v.product) ?? 0;
      const notice =
        minAllowed > 0 && storedVal < minAllowed
          ? `Minimal narx ${money(minAllowed)} — bu sotuv admin ko‘rigiga belgilanadi`
          : '';
      onChange(setLinePrice(cart, v.product, storedVal), notice);
      return;
    }

    emit(setLineQuantity(cart, lineFor(v, value), v.quantity), unitLabel);
  }

  return (
    <div className="space-y-2">
      <input
        className="field"
        aria-label="Tovar qidirish"
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
            packInfo={packInfoOf?.(v.product)}
            editing={editing?.product === v.product ? editing.field : null}
            onAdd={() => handleAdd(v)}
            onRemoveOne={(q) => handleRemoveOne(v, q)}
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
  packInfo?: { package_type?: string | undefined; pack_quantity?: string | number | undefined } | undefined;
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
  packInfo,
  editing,
  onAdd,
  onRemoveOne,
  onEdit,
  onCommit,
}: RowProps): ReactElement {
  const name = stock.product_name;
  const price = line?.price ?? defaultPrice;
  const selected = line != null;
  const packQty = Number(packInfo?.pack_quantity) || 1;
  const unitLabel = productUnitLabel({ ...packInfo, unit: stock.unit });

  return (
    <li
      className={`flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-sm border transition-all dark:bg-gray-900 ${
        selected
          ? 'border-brand/40 ring-2 ring-brand/20 bg-brand/5 dark:bg-brand/10'
          : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:opacity-60"
        onClick={onAdd}
        disabled={remaining === 0}
        aria-label={`${name} — 1 ta qo'shish`}
      >
        {thumb ? (
          <img src={thumb} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover border border-gray-100 dark:border-gray-800" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800">
            <Package size={20} aria-hidden />
          </div>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span>
              {remaining} {unitLabel} qoldi
            </span>
            {packQty > 1 && (
              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand dark:bg-brand/20">
                1 {unitLabel} = {packQty} {stock.unit}
              </span>
            )}
          </span>
        </span>
      </button>

      {editing === 'price' ? (
        <InlineNumber
          label={`${name} narxi`}
          initial={price}
          onCommit={(raw) => onCommit('price', raw)}
        />
      ) : (
        <button
          className={`min-h-[48px] shrink-0 rounded-xl px-2 text-xs font-medium text-gray-600 dark:text-gray-300 flex flex-col items-end justify-center ${
            selected ? 'underline decoration-dotted font-semibold text-brand' : ''
          }`}
          onClick={() => onEdit('price')}
          disabled={!selected}
          aria-label={`${name} narxini o‘zgartirish`}
        >
          <span>{money(price)}</span>
        </button>
      )}

      {selected && (
        <button
          className="flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-transform"
          onClick={() => onRemoveOne(line.quantity)}
          aria-label={`${name} — kamaytirish`}
        >
          <Minus size={20} aria-hidden />
        </button>
      )}
      {selected &&
        (editing === 'qty' ? (
          <InlineNumber label={`${name} miqdori`} initial={line.quantity} onCommit={(raw) => onCommit('qty', raw)} />
        ) : (
          <button
            className="min-h-[48px] min-w-[3rem] shrink-0 text-center text-lg font-bold flex flex-col items-center justify-center"
            onClick={() => onEdit('qty')}
            aria-label={`${name} miqdorini yozish`}
          >
            <span>{line.quantity}</span>
            <span className="text-[10px] font-normal text-gray-500 leading-none">
              {unitLabel}
            </span>
          </button>
        ))}
      <button
        className="flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg hover:brightness-110 active:scale-95 transition-transform disabled:opacity-40"
        onClick={onAdd}
        disabled={remaining === 0}
        aria-label={`${name} — ko'paytirish`}
      >
        <Plus size={20} aria-hidden />
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
      className="field h-12 w-20 shrink-0 px-2 py-1 text-center font-bold"
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
