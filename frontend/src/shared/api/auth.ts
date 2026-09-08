import { api } from '@/shared/api/client';
import type { ApiSuccess, LoginResponse, User } from '@/shared/types/api';

export interface LoginPayload {
  phone: string;
  password: string;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  // Login endpointi to'g'ridan-to'g'ri { success, data } qaytaradi
  const { data } = await api.post<ApiSuccess<LoginResponse>>('/auth/login/', payload);
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
