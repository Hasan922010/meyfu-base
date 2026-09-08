/**
 * Blob'ni yangi tabda ochadi (PDF ko'rish uchun). Auth talab qiladigan
 * endpointlardan olingan fayllar uchun — `window.open(url)` header yubormaydi,
 * shuning uchun avval blob sifatida yuklab, keyin object-URL ochamiz.
 */
export function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  // Tab yopilmaguncha URL yashaydi; ~1 daqiqadan keyin tozalaymiz
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (!win) {
    // Popup bloklangan — yuklab olishga qaytamiz
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hujjat.pdf';
    a.click();
  }
}
