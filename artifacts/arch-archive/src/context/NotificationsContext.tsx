import React, { createContext, useContext, useState, useMemo } from 'react';
import { useAppContext } from './AppContext';
import { mockContractors } from '../data/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body: string;
  level: 'danger' | 'warning' | 'info';
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

// ─── Badge color tokens (matching existing typePill system in dashboard) ──────

export const NOTIF_COLORS = {
  danger: {
    dark:  { bg: 'rgba(255,0,128,0.10)',  text: '#ff4da6', border: 'rgba(255,0,128,0.30)'  },
    light: { bg: 'rgba(236,72,153,0.10)', text: '#be185d', border: 'rgba(236,72,153,0.28)' },
  },
  warning: {
    dark:  { bg: 'rgba(251,191,36,0.10)',  text: '#fbbf24', border: 'rgba(251,191,36,0.28)' },
    light: { bg: 'rgba(202,138,4,0.09)',   text: '#92400e', border: 'rgba(202,138,4,0.24)'  },
  },
  info: {
    dark:  { bg: 'rgba(0,240,255,0.10)',  text: '#00f0ff', border: 'rgba(0,240,255,0.28)' },
    light: { bg: 'rgba(6,182,212,0.10)', text: '#0e7490', border: 'rgba(6,182,212,0.26)' },
  },
} as const;

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { projects } = useAppContext();
  const TODAY = new Date();

  const baseNotifications = useMemo<Omit<Notification, 'isRead'>[]>(() => {
    const result: Omit<Notification, 'isRead'>[] = [];

    // ── Contractor registration alerts ──
    mockContractors.forEach(c => {
      if (!c.commercialRegistrationExpiry) return;
      const expiry   = new Date(c.commercialRegistrationExpiry);
      const daysLeft = Math.ceil((expiry.getTime() - TODAY.getTime()) / 86400000);
      if (daysLeft < 0) {
        result.push({
          id: `ntf-cont-exp-${c.id}`,
          level: 'danger',
          title: 'سجل تجاري منتهي',
          body:  `${c.name} — انتهى منذ ${Math.abs(daysLeft)} يوم`,
          link:  `/contractors/${c.id}`,
          createdAt: c.commercialRegistrationExpiry,
        });
      } else if (daysLeft <= 30) {
        result.push({
          id: `ntf-cont-urg-${c.id}`,
          level: 'danger',
          title: 'سجل تجاري ينتهي قريباً',
          body:  `${c.name} — ينتهي خلال ${daysLeft} يوم`,
          link:  `/contractors/${c.id}`,
          createdAt: new Date().toISOString(),
        });
      } else if (daysLeft <= 90) {
        result.push({
          id: `ntf-cont-wrn-${c.id}`,
          level: 'warning',
          title: 'سجل تجاري يقترب من الانتهاء',
          body:  `${c.name} — ينتهي خلال ${daysLeft} يوم`,
          link:  `/contractors/${c.id}`,
          createdAt: new Date().toISOString(),
        });
      }
    });

    // ── Project end-date alerts ──
    projects.filter(p => p.status === 'active' && p.endDate).forEach(p => {
      const endDate  = new Date(p.endDate!);
      const daysLeft = Math.ceil((endDate.getTime() - TODAY.getTime()) / 86400000);
      if (daysLeft < 0) {
        result.push({
          id: `ntf-proj-late-${p.id}`,
          level: 'danger',
          title: 'تأخر في إنجاز المشروع',
          body:  `${p.name} — تجاوز الموعد بـ ${Math.abs(daysLeft)} يوم`,
          link:  `/projects/${p.id}`,
          createdAt: p.endDate!,
        });
      } else if (daysLeft <= 60) {
        result.push({
          id: `ntf-proj-wrn-${p.id}`,
          level: 'warning',
          title: 'اقتراب موعد تسليم مشروع',
          body:  `${p.name} — يتبقى ${daysLeft} يوم`,
          link:  `/projects/${p.id}`,
          createdAt: new Date().toISOString(),
        });
      }
    });

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const notifications = useMemo<Notification[]>(
    () => baseNotifications.map(n => ({ ...n, isRead: readIds.has(n.id) })),
    [baseNotifications, readIds],
  );

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const markRead = (id: string) =>
    setReadIds(prev => new Set([...prev, id]));

  const markAllRead = () =>
    setReadIds(new Set(notifications.map(n => n.id)));

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
