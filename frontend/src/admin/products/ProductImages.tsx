import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Star, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';
import { resizeImage } from '@/shared/lib/imageResize';
import type { ProductImage } from '@/shared/types/catalog';

interface Props {
  productId: string;
}

export function ProductImages({ productId }: Props): ReactElement {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['product', productId],
    queryFn: () => catalogApi.product(productId),
  });
  const images: ProductImage[] = (query.data?.images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const refresh = (): void => {
    void qc.invalidateQueries({ queryKey: ['product', productId] });
    void qc.invalidateQueries({ queryKey: ['products'] });
  };

  async function onFiles(fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const files = await Promise.all(
        Array.from(fileList).map((f) => resizeImage(f)),
      );
      await catalogApi.uploadImages(productId, files);
      refresh();
    } catch (e) {
      setErr(extractApiError(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const setPrimary = useMutation({
    mutationFn: (id: string) =>
      catalogApi.patchImage(productId, id, { is_primary: true }),
    onSuccess: refresh,
    onError: (e) => setErr(extractApiError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => catalogApi.deleteImage(productId, id),
    onSuccess: refresh,
    onError: (e) => setErr(extractApiError(e)),
  });
  const move = useMutation({
    mutationFn: ({ id, sort_order }: { id: string; sort_order: number }) =>
      catalogApi.patchImage(productId, id, { sort_order }),
    onSuccess: refresh,
  });

  function shift(idx: number, dir: -1 | 1): void {
    const a = images[idx];
    const b = images[idx + dir];
    if (!a || !b) return;
    move.mutate({ id: a.id, sort_order: b.sort_order });
    move.mutate({ id: b.id, sort_order: a.sort_order });
  }

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Rasmlar ({images.length})</span>
        <button
          type="button"
          className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={15} aria-hidden />
          {busy ? 'Yuklanmoqda…' : 'Rasm qo‘shish'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void onFiles(e.target.files)}
        />
      </div>

      {err && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</p>
      )}

      {images.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-400">
          Rasm yo‘q — adashmaslik uchun mahsulot rasmini qo‘shing.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className={`group relative overflow-hidden rounded-lg border ${
                img.is_primary
                  ? 'border-brand ring-1 ring-brand'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <img
                src={img.thumbnail ?? img.image}
                alt=""
                className="aspect-square w-full object-cover"
              />
              {img.is_primary && (
                <span className="absolute left-1 top-1 rounded bg-brand px-1 py-0.5 text-[10px] font-medium text-brand-fg">
                  Asosiy
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/45 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  className="text-white disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => shift(idx, -1)}
                  aria-label="Chapga"
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                {!img.is_primary && (
                  <button
                    type="button"
                    className="text-white"
                    onClick={() => setPrimary.mutate(img.id)}
                    aria-label="Asosiy qilish"
                  >
                    <Star size={15} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  className="text-white"
                  onClick={() => remove.mutate(img.id)}
                  aria-label="O'chirish"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  className="text-white disabled:opacity-30"
                  disabled={idx === images.length - 1}
                  onClick={() => shift(idx, 1)}
                  aria-label="O'ngga"
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
