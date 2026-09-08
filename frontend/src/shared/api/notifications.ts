import { listPage, postAction, retrieve, type QueryParams } from '@/shared/api/crud';

export interface Notification {
  id: string;
  type: string;
  type_display: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export const notificationsApi = {
  list: (params?: QueryParams) => listPage<Notification>('/notifications/', params),
  unreadCount: () => retrieve<{ count: number }>('/notifications/unread-count/'),
  markRead: (id: string) => postAction<Notification>(`/notifications/${id}/read/`),
  markAllRead: () => postAction<{ updated: number }>('/notifications/read-all/'),
};
