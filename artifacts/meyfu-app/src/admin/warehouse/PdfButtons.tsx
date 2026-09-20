import { FileText, Stamp } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { openBlob } from '@/shared/lib/openBlob';

interface Props {
  fetchPdf: (stamp: boolean) => Promise<Blob>;
}

/** «Pechatsiz» va «Pechat bilan» PDF tugmalari (nakladnoy / yuklama). */
export function PdfButtons({ fetchPdf }: Props): ReactElement {
  const [busy, setBusy] = useState<'plain' | 'stamp' | null>(null);

  async function open(stamp: boolean): Promise<void> {
    setBusy(stamp ? 'stamp' : 'plain');
    try {
      openBlob(await fetchPdf(stamp));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <button
        className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        disabled={busy !== null}
        onClick={() => void open(false)}
        title="Pechatsiz PDF"
      >
        <FileText size={13} aria-hidden />
        {busy === 'plain' ? '…' : 'PDF'}
      </button>
      <button
        className="flex items-center gap-1 rounded-lg border border-brand/40 px-2 py-1 text-xs text-brand hover:bg-brand/5"
        disabled={busy !== null}
        onClick={() => void open(true)}
        title="Pechat (muhr) bilan PDF"
      >
        <Stamp size={13} aria-hidden />
        {busy === 'stamp' ? '…' : 'Pechat'}
      </button>
    </div>
  );
}
