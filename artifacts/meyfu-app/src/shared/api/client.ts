import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/shared/config/env';
import { queryClient } from '@/app/queryClient';
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

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const { refresh, setTokens, clear } = useAuthStore.getState();
  if (!refresh) {
    clear();
    queryClient.clear();
    return null;
  }
  try {
    const resp = await axios.post<{ access: string; refresh?: string }>(
      `${env.apiBaseUrl}/auth/refresh/`,
      { refresh },
    );
    setTokens({
      access: resp.data.access,
      refresh: resp.data.refresh ?? refresh,
    });
    return resp.data.access;
  } catch {
    clear();
    queryClient.clear();
    return null;
  }
}

function isAuthEndpoint(url?: string): boolean {
  return Boolean(url && /\/auth\/(login|refresh|logout)\/?(?:[?#]|$)/.test(url));
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !isAuthEndpoint(original.url) && !original._retried) {
      original._retried = true;
      refreshPromise ??= refreshAccess().finally(() => {
        refreshPromise = null;
      });
      const newAccess = await refreshPromise;
      if (newAccess) {
        original.headers.set('Authorization', `Bearer ${newAccess}`);
        return api.request(original);
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
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
