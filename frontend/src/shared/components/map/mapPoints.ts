import type { MapPoint } from './LeafletMap';

/** "41.311100" kabi satr koordinatalarni raqamga; yo'q/yaroqsiz bo'lsa null. */
export function toPoint(
  id: string,
  lat: string | number | null | undefined,
  lng: string | number | null | undefined,
  label: string,
  color?: string,
): MapPoint | null {
  const la = Number(lat);
  const ln = Number(lng);
  const missing = lat == null || lng == null || lat === '' || lng === '';
  if (missing || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return color ? { id, lat: la, lng: ln, label, color } : { id, lat: la, lng: ln, label };
}
