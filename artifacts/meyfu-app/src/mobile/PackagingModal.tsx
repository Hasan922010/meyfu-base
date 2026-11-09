import { useEffect, useState, type ReactElement } from 'react';

import type { CachedVanStock } from '@/offline/db';
import type { CartLine } from '@/mobile/lib/cart';
import { Modal } from '@/shared/components/Modal';
import { PriceFormulaCard } from '@/shared/components/PriceFormulaCard';
import { QuantityStepper } from '@/shared/components/QuantityStepper';
import { UnitToggle } from '@/shared/components/UnitToggle';
import { money } from '@/shared/lib/format';

interface Props {
  open: boolean;
  stock: CachedVanStock | null;
  packInfo?: { package_type?: string | undefined; pack_quantity?: string | number | undefined } | undefined;
  currentLine?: CartLine | undefined;
  defaultPrice: number;
  minPrice?: number | undefined;
  onClose: () => void;
  onConfirm: (line: CartLine) => void;
}

export function PackagingModal({
  open,
  stock,
  packInfo,
  currentLine,
  defaultPrice,
  minPrice = 0,
  onClose,
  onConfirm,
}: Props): ReactElement | null {
  const packQuantity = Math.max(1, Number(packInfo?.pack_quantity) || 1);
  const packageType = packInfo?.package_type?.trim() || 'qadoq';
  const baseUnit = stock?.unit || 'dona';

  const [mode, setMode] = useState<'base' | 'package'>('package');
  const [count, setCount] = useState<number>(1);
  const [price, setPrice] = useState<number>(defaultPrice);

  // Sync state whenever stock or currentLine changes
  useEffect(() => {
    if (!open || !stock) return;
    const initialPrice = currentLine?.price ?? defaultPrice;
    setPrice(initialPrice);

    if (currentLine) {
      if (currentLine.unit_mode === 'package' && currentLine.package_count) {
        setMode('package');
        setCount(currentLine.package_count);
      } else {
        setMode('base');
        setCount(currentLine.quantity);
      }
    } else {
      setMode(packQuantity > 1 ? 'package' : 'base');
      setCount(1);
    }
  }, [open, stock, currentLine, defaultPrice, packQuantity]);

  if (!open || !stock) return null;

  const maxPackages = Math.floor(stock.quantity / packQuantity);
  const maxPieces = stock.quantity;
  const isPack = mode === 'package';
  const totalBaseQty = isPack ? count * packQuantity : count;
  const totalPrice = totalBaseQty * price;

  function handleModeChange(nextMode: 'base' | 'package'): void {
    setMode(nextMode);
    if (nextMode === 'package') {
      const converted = Math.floor(count / packQuantity) || 1;
      setCount(Math.max(1, Math.min(Math.max(1, maxPackages), converted)));
    } else {
      const converted = count * packQuantity;
      setCount(Math.max(1, Math.min(maxPieces, converted)));
    }
  }

  function handleCountChange(val: number): void {
    const max = isPack ? Math.max(1, maxPackages) : maxPieces;
    const clamped = Math.max(1, Math.min(max, val));
    setCount(clamped);
  }

  function handleConfirm(): void {
    if (!stock || totalBaseQty <= 0 || totalBaseQty > stock.quantity) return;
    onConfirm({
      product: stock.product,
      product_name: stock.product_name,
      quantity: totalBaseQty,
      price,
      unit_mode: isPack ? 'package' : 'base',
      package_count: isPack ? count : undefined,
      package_type: isPack ? packageType : undefined,
      pack_quantity: packQuantity,
      unit_name: baseUnit,
      max: stock.quantity,
    });
    onClose();
  }

  const isBelowMin = minPrice > 0 && price < minPrice;
  const isOutOfStock = totalBaseQty > stock.quantity;

  return (
    <Modal
      open={open}
      title={`${stock.product_name} — miqdor tanlash`}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-4">
        {/* Ombordagi/mashinadagi qoldiq ma'lumoti */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-2.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <span>
            Mashinada mavjud:{' '}
            <strong className="text-gray-900 dark:text-white">
              {stock.quantity} {baseUnit}
            </strong>
            {packQuantity > 1 && (
              <span className="text-gray-500">
                {' '}
                ({maxPackages} {packageType})
              </span>
            )}
          </span>
          {packQuantity > 1 && (
            <span className="rounded bg-brand/10 px-2 py-0.5 font-semibold text-brand">
              1 {packageType} = {packQuantity} {baseUnit}
            </span>
          )}
        </div>

        {/* Dona / Qadoq tanlovi */}
        {packQuantity > 1 && (
          <UnitToggle
            mode={mode}
            baseUnit={baseUnit}
            packageType={packageType}
            packQuantity={packQuantity}
            onChange={handleModeChange}
          />
        )}

        {/* Agar mashinada butun qadoq bo'lmasa eslatma */}
        {isPack && maxPackages === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
            Mashinada to'liq {packageType} yo'q ({stock.quantity} {baseUnit} bor). Donalab sotish rejimiga o'tishingiz mumkin.
          </div>
        )}

        {/* Miqdor tanlash */}
        <div className="space-y-2">
          <QuantityStepper
            value={count}
            unitLabel={isPack ? packageType : baseUnit}
            onChange={handleCountChange}
            quickOptions={isPack ? [1, 2, 5, 10, 20] : [1, 5, 10, 12, 24, 50]}
          />

          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-gray-500">To'g'ridan-to'g'ri yozish:</span>
            <input
              type="number"
              min="1"
              max={isPack ? maxPackages : maxPieces}
              className="field h-9 w-24 text-center font-bold"
              value={count}
              onChange={(e) => handleCountChange(Number(e.target.value))}
              aria-label={`${isPack ? packageType : baseUnit} miqdori`}
            />
          </div>
        </div>

        {/* Hisoblash formulasi */}
        <PriceFormulaCard
          isPackage={isPack}
          packageCount={count}
          packageType={packageType}
          packQuantity={packQuantity}
          baseUnit={baseUnit}
          totalBaseQty={totalBaseQty}
          unitPrice={price}
          totalPrice={totalPrice}
        />

        {/* Narx sozlamasi */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>1 {baseUnit} narxi:</span>
            {minPrice > 0 && <span>Minimal narx: {money(minPrice)}</span>}
          </div>
          <input
            type="number"
            className="field font-bold"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            aria-label="Tovar narxi"
          />
          {isBelowMin && (
            <p className="text-[11px] font-medium text-warning-600">
              Minimal narxdan past — sotuv tekshiruvga tushadi
            </p>
          )}
        </div>

        {/* Tasdiqlash / Bekor qilish */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="btn min-h-[48px] flex-1 font-semibold"
            onClick={onClose}
          >
            Bekor qilish
          </button>
          <button
            type="button"
            className="btn-brand min-h-[48px] flex-[2] text-base font-bold shadow-md shadow-brand/20 active:scale-[0.98] transition disabled:opacity-50"
            disabled={isOutOfStock || totalBaseQty <= 0}
            onClick={handleConfirm}
          >
            {isOutOfStock ? "Mashinada yetarli emas" : `Savatga qo'shish · ${money(totalPrice)}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

