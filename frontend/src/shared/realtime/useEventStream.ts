import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { env } from '@/shared/config/env';
import { useToast } from '@/shared/lib/toast';
import { useAuthStore } from '@/shared/store/authStore';

interface ServerEvent {
  event: string;
  payload: Record<string, unknown>;
}

function s(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

/**
 * WebSocket event oqimi (CLAUDE.md 11).
 * WS uzilsa ilova ishlashda davom etadi — bu faqat qulaylik:
 *  - react-query keshlarini yangilaydi
 *  - muhim hodisalarda toast ko'rsatadi
 */
export function useEventStream(): { connected: boolean } {
  const qc = useQueryClient();
  const toast = useToast();
  const access = useAuthStore((s) => s.access);
  const [connected, setConnected] = useState<boolean>(false);
  const retryRef = useRef<number>(0);

  useEffect(() => {
    if (!access) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: number | undefined;

    const connect = (): void => {
      if (closed) return;
      const url = `${env.wsUrl}?token=${encodeURIComponent(access)}`;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = (): void => {
        setConnected(true);
        retryRef.current = 0;
      };
      ws.onclose = (): void => {
        setConnected(false);
        scheduleReconnect();
      };
      ws.onerror = (): void => ws?.close();
      ws.onmessage = (e: MessageEvent<string>): void => {
        try {
          handleEvent(JSON.parse(e.data) as ServerEvent);
        } catch {
          /* e'tiborsiz */
        }
      };
    };

    const scheduleReconnect = (): void => {
      if (closed) return;
      const delay = Math.min(30_000, 2 ** retryRef.current * 1000);
      retryRef.current += 1;
      reconnectTimer = window.setTimeout(connect, delay);
    };

    const handleEvent = (msg: ServerEvent): void => {
      switch (msg.event) {
        case 'sale.created':
        case 'dashboard.tick':
          void qc.invalidateQueries({ queryKey: ['dashboard'] });
          void qc.invalidateQueries({ queryKey: ['admin-sales'] });
          break;
        case 'sale.flagged':
          void qc.invalidateQueries({ queryKey: ['admin-sales'] });
          toast.push({
            kind: 'warning',
            title: 'Belgilangan sotuv',
            body: s(msg.payload, 'reason') || s(msg.payload, 'number'),
          });
          break;
        case 'expense.limit_exceeded':
          void qc.invalidateQueries({ queryKey: ['admin-expenses'] });
          toast.push({
            kind: 'warning',
            title: 'Xarajat limiti oshdi',
            body: `${s(msg.payload, 'distributor')} · ${s(msg.payload, 'amount')}`,
          });
          break;
        case 'expense.approved':
          void qc.invalidateQueries({ queryKey: ['wallet'] });
          void qc.invalidateQueries({ queryKey: ['expenses'] });
          toast.push({ kind: 'success', title: 'Xarajat tasdiqlandi' });
          break;
        case 'expense.rejected':
          void qc.invalidateQueries({ queryKey: ['expenses'] });
          toast.push({
            kind: 'danger',
            title: 'Xarajat rad etildi',
            body: s(msg.payload, 'reason'),
          });
          break;
        case 'wallet.updated':
          void qc.invalidateQueries({ queryKey: ['wallet'] });
          break;
        case 'loading.confirmed':
          void qc.invalidateQueries({ queryKey: ['loadings'] });
          void qc.invalidateQueries({ queryKey: ['dashboard'] });
          break;
        case 'stock.low':
          void qc.invalidateQueries({ queryKey: ['stock'] });
          toast.push({
            kind: 'warning',
            title: 'Kam qoldiq',
            body: `${s(msg.payload, 'product_name')} — ${s(msg.payload, 'quantity')}`,
          });
          break;
        case 'dayclose.submitted':
        case 'cash.difference':
          void qc.invalidateQueries({ queryKey: ['day-closes'] });
          void qc.invalidateQueries({ queryKey: ['dashboard'] });
          if (msg.event === 'cash.difference') {
            toast.push({
              kind: 'danger',
              title: 'Kun yopishda farq bor',
              body: s(msg.payload, 'distributor'),
            });
          }
          break;
        case 'invoice_scan.completed':
        case 'invoice_scan.failed':
          void qc.invalidateQueries({ queryKey: ['scans'] });
          void qc.invalidateQueries({ queryKey: ['scan'] });
          toast.push({
            kind: msg.event === 'invoice_scan.failed' ? 'danger' : 'info',
            title:
              msg.event === 'invoice_scan.failed'
                ? 'Naklit o‘qilmadi'
                : 'Naklit o‘qildi — tekshiring',
            body: s(msg.payload, 'number'),
          });
          break;
        case 'notification.new':
          void qc.invalidateQueries({ queryKey: ['notifications'] });
          toast.push({
            kind: 'info',
            title: s(msg.payload, 'title') || 'Bildirishnoma',
            body: s(msg.payload, 'body'),
          });
          break;
        default:
          break;
      }
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [access, qc, toast]);

  return { connected };
}
