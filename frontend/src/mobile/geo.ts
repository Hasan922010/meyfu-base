export interface Coords {
  latitude: string;
  longitude: string;
}

/**
 * Va'dani ko'pi bilan `ms` kutadi, ulgurmasa null. Sotuvni saqlash GPS ga bog'lanib
 * 8 soniyagacha qotib qolmasligi uchun (UX audit m3).
 */
export function waitAtMost<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

/** Bir martalik GPS o'qish. Ruxsat berilmasa yoki xato bo'lsa — null (CLAUDE.md 8). */
export function getCurrentCoords(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  });
}
