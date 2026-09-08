import { Download, Share2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import type { ReceiptDoc } from './lib/receiptPdf';

interface Props {
  /** Chek ma'lumotini bosilganda quradi (lokal holatdan). */
  getDoc: () => ReceiptDoc;
  filename: string;
}

/**
 * «PDF saqlash» va «Ulashish» tugmalari. jspdf + shrift faqat shu yerda
 * dinamik import qilinadi — asosiy mobil bundle'ga tushmaydi.
 */
export function ReceiptButtons({ getDoc, filename }: Props): ReactElement {
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stale, setStale] = useState<boolean>(false);

  async function run(mode: 'save' | 'share'): Promise<void> {
    setBusy(mode);
    setErr(null);
    try {
      const [pdf, cache, share] = await Promise.all([
        import('./lib/receiptPdf'),
        import('./lib/companyCache'),
        import('./lib/sharePdf'),
      ]);
      const { company, stale: isStale } = await cache.getCompanyCache();
      setStale(isStale && company !== null);
      const blob = pdf.buildReceiptPdf(getDoc(), company);
      if (mode === 'share') await share.sharePdf(blob, filename);
      else share.downloadPdf(blob, filename);
    } catch {
      setErr('PDF yaratib bo‘lmadi.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex gap-2">
        <button
          className="btn flex flex-1 items-center justify-center gap-1.5"
          disabled={busy !== null}
          onClick={() => void run('save')}
        >
          <Download size={16} aria-hidden />
          {busy === 'save' ? '…' : 'PDF saqlash'}
        </button>
        <button
          className="btn-brand flex flex-1 items-center justify-center gap-1.5"
          disabled={busy !== null}
          onClick={() => void run('share')}
        >
          <Share2 size={16} aria-hidden />
          {busy === 'share' ? '…' : 'Ulashish'}
        </button>
      </div>
      {stale && (
        <p className="text-center text-xs text-gray-400">
          Kompaniya rekvizitlari eskirgan — internet bo‘lganda yangilanadi.
        </p>
      )}
      {err && <p className="text-center text-xs text-danger">{err}</p>}
    </div>
  );
}
