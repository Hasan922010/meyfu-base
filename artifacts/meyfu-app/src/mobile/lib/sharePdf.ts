/**
 * PDF Blob'ni mijozga uzatish: avval Web Share (WhatsApp/Telegram'ga fayl),
 * bo'lmasa yuklab olish (PWA'da ishlaydi). Bu haqiqiy ilova — artifact emas.
 */
export async function sharePdf(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch {
      // foydalanuvchi bekor qildi yoki xato — yuklab olishga o'tamiz
    }
  }
  downloadPdf(blob, filename);
}

export function downloadPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
