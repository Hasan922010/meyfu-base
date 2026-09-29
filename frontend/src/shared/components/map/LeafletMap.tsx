import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef, type ReactElement } from 'react';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  /** Bosilganda chiqadigan matn (oddiy matn — HTML emas) */
  label: string;
  color?: string;
}

export interface LeafletMapProps {
  points: MapPoint[];
  /** Nuqtalarni ketma-ket chiziq bilan bog'lash (marshrut tartibi) */
  connect?: boolean;
  /** Nuqtalarga tartib raqamini yozish */
  numbered?: boolean;
  height?: number;
}

const TASHKENT: L.LatLngTuple = [41.3111, 69.2797];
const DEFAULT_COLOR = '#4f46e5';

/** Leaflet matnni HTML sifatida qo'yadi — DOM tugun beramiz, shunda XSS bo'lmaydi. */
function textNode(text: string): HTMLElement {
  const el = document.createElement('span');
  el.textContent = text;
  return el;
}

/**
 * Leaflet + OpenStreetMap (v5 B2). Faqat `React.lazy` orqali yuklanadi —
 * leaflet asosiy bundle'ga tushmaydi. Markerlar — circleMarker (rasm fayli kerak emas).
 */
export default function LeafletMap({
  points,
  connect = false,
  numbered = false,
  height = 360,
}: LeafletMapProps): ReactElement {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!box.current || map.current) return undefined;
    map.current = L.map(box.current, { zoomControl: true }).setView(TASHKENT, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!map.current || !group) return;
    group.clearLayers();
    const coords: L.LatLngTuple[] = points.map((p) => [p.lat, p.lng]);
    points.forEach((p, i) => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: numbered ? 10 : 7,
        color: '#fff',
        weight: 2,
        fillColor: p.color ?? DEFAULT_COLOR,
        fillOpacity: 0.9,
      });
      if (numbered) {
        marker.bindPopup(textNode(`${i + 1}. ${p.label}`));
        marker.bindTooltip(textNode(String(i + 1)), {
          permanent: true,
          direction: 'center',
          className: 'map-num',
        });
      } else {
        marker.bindTooltip(textNode(p.label));
      }
      marker.addTo(group);
    });
    if (connect && coords.length > 1) {
      L.polyline(coords, { color: DEFAULT_COLOR, weight: 3, opacity: 0.7 }).addTo(group);
    }
    if (coords.length > 0) {
      map.current.fitBounds(L.latLngBounds(coords), { padding: [24, 24], maxZoom: 15 });
    }
  }, [points, connect, numbered]);

  return (
    <div
      ref={box}
      style={{ height }}
      className="w-full overflow-hidden rounded-xl"
      role="region"
      aria-label="Xarita"
    />
  );
}
