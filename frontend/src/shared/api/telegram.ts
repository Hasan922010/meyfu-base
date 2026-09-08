import { postAction, retrieve } from '@/shared/api/crud';

export interface TelegramStatus {
  linked: boolean;
  enabled: boolean;
  bot_username: string;
}

export interface TelegramLink {
  code: string;
  expires_at: string;
  deep_link: string;
  bot_username: string;
  enabled: boolean;
}

export const telegramApi = {
  status: () => retrieve<TelegramStatus>('/telegram/status/'),
  link: () => postAction<TelegramLink>('/telegram/link/'),
  unlink: () => postAction<{ linked: boolean }>('/telegram/unlink/'),
};
