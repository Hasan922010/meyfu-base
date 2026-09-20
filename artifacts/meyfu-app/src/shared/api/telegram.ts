import { create, postAction, retrieve } from '@/shared/api/crud';

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

export interface TelegramBotConfig {
  configured: boolean;
  bot_username: string;
  managed_in_profile: boolean;
  updated_at: string | null;
}

export const telegramApi = {
  status: () => retrieve<TelegramStatus>('/telegram/status/'),
  link: () => postAction<TelegramLink>('/telegram/link/'),
  unlink: () => postAction<{ linked: boolean }>('/telegram/unlink/'),
  botConfig: () => retrieve<TelegramBotConfig>('/telegram/bot-config/'),
  updateBotToken: (token: string) =>
    create<TelegramBotConfig, { token: string }>('/telegram/bot-config/', { token }),
};
