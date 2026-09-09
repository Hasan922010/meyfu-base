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

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const { refresh, setAccess, clear } = useAuthStore.getState();
  if (!refresh) {
    clear();
    return null;
  }
  try {
    const resp = await axios.post<{ access: string }>(
      `${env.apiBaseUrl}/auth/refresh/`,
      { refresh },
    );
    setAccess(resp.data.access);
    return resp.data.access;
  } catch {
    clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retried) {
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
      return body.error.message;
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
