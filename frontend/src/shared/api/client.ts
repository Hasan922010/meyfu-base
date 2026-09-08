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

export function extractApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body && body.success === false) {
      return body.error.message;
    }
    return error.message;
  }
  return 'Kutilmagan xatolik.';
}
