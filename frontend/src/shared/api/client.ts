import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/shared/config/env';
import { useAuthStore } from '@/shared/store/authStore';
import type { ApiErrorBody } from '@/shared/types/api';

export const api: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

// --- So'rovga access token qo'shish ---
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { access } = useAuthStore.getState();
  if (access) {
    config.headers.set('Authorization', `Bearer ${access}`);
  }
  return config;
});

// --- 401 da bir marta refresh, keyin logout ---
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

/** access — yangi token; sessionEnded — server refresh'ni rad etdi, qayta kirish kerak. */
type RefreshResult = { access: string } | { access: null; sessionEnded: boolean };

let refreshPromise: Promise<RefreshResult> | null = null;

/** Server refresh tokenni rad etdimi (muddati o'tgan, qora ro'yxatda, noto'g'ri)? */
function isRefreshRejected(err: unknown): boolean {
  const status = axios.isAxiosError(err) ? err.response?.status : undefined;
  return status === 401 || status === 400;
}

/**
 * Boshqa tab refresh tokenni allaqachon almashtirgan bo'lishi mumkin (rotatsiya +
 * qora ro'yxat) — localStorage'dagi eng yangi holatni olamiz. `failedAccess` bilan
 * farq qilsa, boshqa tab yangilagan: shu access bilan qayta urinish kifoya.
 */
async function newerTokenFromOtherTab(failedAccess: string | null): Promise<string | null> {
  await useAuthStore.persist.rehydrate();
  const { access } = useAuthStore.getState();
  return access && access !== failedAccess ? access : null;
}

async function refreshAccess(failedAccess: string | null): Promise<RefreshResult> {
  const fromOtherTab = await newerTokenFromOtherTab(failedAccess);
  if (fromOtherTab) return { access: fromOtherTab };

  const { refresh, setAccess, clear } = useAuthStore.getState();
  if (!refresh) {
    clear();
    return { access: null, sessionEnded: true };
  }
  try {
    const resp = await axios.post<{ access: string; refresh?: string }>(
      `${env.apiBaseUrl}/auth/refresh/`,
      { refresh },
    );
    // Eski refresh serverda qora ro'yxatga tushgan — yangisini saqlamasak
    // keyingi refresh 401 beradi va foydalanuvchi chiqarib yuboriladi
    setAccess(resp.data.access, resp.data.refresh);
    return { access: resp.data.access };
  } catch (err) {
    // Faqat server rad etsa chiqaramiz. Tarmoq uzilishi yoki 5xx da sessiya qoladi —
    // aks holda beqaror internetda tarqatuvchi tizimdan chiqib ketardi (UX audit N2)
    if (isRefreshRejected(err)) {
      // Poyga: so'rovimiz ketayotganda boshqa tab rotatsiyani yakunlagan bo'lishi mumkin
      const raced = await newerTokenFromOtherTab(failedAccess);
      if (raced) return { access: raced };
      clear();
      return { access: null, sessionEnded: true };
    }
    console.warn('[refreshAccess] vaqtincha xato, sessiya saqlandi', err);
    return { access: null, sessionEnded: false };
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retried) {
      original._retried = true;
      const failedAccess =
        String(original.headers.get('Authorization') ?? '').replace(/^Bearer /, '') || null;
      refreshPromise ??= refreshAccess(failedAccess).finally(() => {
        refreshPromise = null;
      });
      const result = await refreshPromise;
      if (result.access) {
        original.headers.set('Authorization', `Bearer ${result.access}`);
        return api.request(original);
      }
      if (
        result.sessionEnded &&
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login'
      ) {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  },
);

const CONN_REFUSED_RE = /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up/i;

const FIELD_LABELS: Record<string, string> = {
  non_field_errors: '',
  detail: '',
  phone: 'Telefon',
  password: 'Parol',
  old_password: 'Joriy parol',
  new_password: 'Yangi parol',
  full_name: 'F.I.SH.',
  amount: 'Summa',
  price: 'Narx',
  quantity: 'Miqdor',
  name: 'Nomi',
  sku: 'SKU',
  barcode: 'Shtrix-kod',
  date: 'Sana',
  due_date: 'Muddat',
};

/**
 * DRF maydon xatolarini (`{"phone": ["..."], "profile": {"x": ["..."]}}`) tekis
 * `{yo'l: xabar}` ko'rinishiga keltiradi (audit UX-001).
 */
export function extractFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof AxiosError) || !error.response) return {};
  const body = error.response.data as ApiErrorBody | undefined;
  const details =
    body && typeof body === 'object' && body.success === false
      ? body.error?.details
      : undefined;
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};

  const toText = (v: unknown): string =>
    typeof v === 'string' ? v : typeof v === 'number' ? String(v) : JSON.stringify(v);

  const out: Record<string, string> = {};
  const walk = (obj: Record<string, unknown>, prefix: string): void => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value)) {
        out[path] = value.map(toText).join('. ');
      } else if (value && typeof value === 'object') {
        walk(value as Record<string, unknown>, path);
      } else if (value != null) {
        out[path] = toText(value);
      }
    }
  };
  walk(details, '');
  return out;
}

function fieldErrorSummary(error: unknown): string | null {
  const fields = extractFieldErrors(error);
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;
  return entries
    .map(([path, message]) => {
      const leaf = path.split('.').pop() ?? path;
      const label = FIELD_LABELS[leaf] ?? leaf;
      return label ? `${label}: ${message}` : message;
    })
    .join(' · ');
}

export function extractApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    // 1. Serverdan javob umuman kelmadi — backend o'chiq, tarmoq yo'q yoki timeout
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return "Server javob bermadi (vaqt tugadi). Birozdan so'ng qayta urinib ko'ring.";
      }
      return "Serverga ulanib bo'lmadi. Internet aloqasini yoki server ishlayotganini tekshiring.";
    }

    // 2. Backendning standart xato formati — { success: false, error: { message } }
    const body = error.response.data as ApiErrorBody | string | undefined;
    if (typeof body === 'object' && body?.success === false && body.error?.message) {
      // Maydon xatolari bo'lsa — qaysi maydon va nega ekanini ko'rsatamiz
      return fieldErrorSummary(error) ?? body.error.message;
    }

    // 3. Javob keldi, lekin standart formatda emas (proxy/gateway/HTML yoki matn)
    const status = error.response.status;
    if (typeof body === 'string' && CONN_REFUSED_RE.test(body)) {
      return "Serverga ulanib bo'lmadi. Server ishga tushirilganini tekshiring.";
    }
    if (status === 502 || status === 503 || status === 504) {
      return "Server vaqtincha ishlamayapti. Birozdan so'ng qayta urinib ko'ring.";
    }
    if (status >= 500) {
      return "Server bilan bog'lanishda xatolik. Birozdan so'ng qayta urinib ko'ring.";
    }
    if (status === 404) {
      return "So'ralgan manzil topilmadi.";
    }
    return error.message;
  }
  // Axios bo'lmagan xato (masalan API shakli tekshiruvi — ApiShapeError)
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Kutilmagan xatolik.';
}
