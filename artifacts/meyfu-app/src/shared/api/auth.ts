import { api } from '@/shared/api/client';
import { queryClient } from '@/app/queryClient';
import { loginDataShape } from '@/shared/api/schemas';
import { assertApiShape } from '@/shared/lib/validate';
import type { ApiSuccess, LoginResponse, User } from '@/shared/types/api';
import { useAuthStore } from '@/shared/store/authStore';

export interface LoginPayload {
  phone: string;
  password: string;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  // Login endpointi to'g'ridan-to'g'ri { success, data } qaytaradi
  const { data } = await api.post<ApiSuccess<LoginResponse>>('/auth/login/', payload);
  assertApiShape(loginDataShape, data?.data, 'login');
  return data.data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<ApiSuccess<User>>('/auth/me/');
  return data.data;
}

export async function issueWebSocketTicket(): Promise<string> {
  const { data } = await api.post<ApiSuccess<{ ticket: string }>>('/auth/ws-ticket/');
  if (!data?.data?.ticket) throw new Error('WebSocket ticket olinmadi');
  return data.data.ticket;
}

export async function logout(): Promise<void> {
  const refresh = useAuthStore.getState().refresh;
  try {
    await api.post('/auth/logout/', refresh ? { refresh } : undefined);
  } catch {
    // Local session is still cleared if the server is unavailable.
  } finally {
    useAuthStore.getState().clear();
    queryClient.clear();
  }
}
