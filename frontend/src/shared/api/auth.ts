import { api } from '@/shared/api/client';
import { loginDataShape } from '@/shared/api/schemas';
import { assertApiShape } from '@/shared/lib/validate';
import type { ApiSuccess, LoginResponse, User } from '@/shared/types/api';

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

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout/');
  } catch {
    // stateless — mijoz baribir tozalaydi
  }
}
