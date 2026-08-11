import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useNotifications, NOTIF_COLORS, Notification } from '../context/NotificationsContext';
import { useAppContext } from '../context/AppContext';
import { Bell, ShieldAlert, AlertTriangle, Info, CheckCheck, ArrowUpRight, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';

// ─── Severity icon ────────────────────────────────────────────────────────────

function LevelIcon({ level, color }: { level: Notification['level']; color: string }) {
  const props = { className: 'w-4 h-4', style: { color } };
  if (level === 'danger')  return <ShieldAlert  {...props} />;
  if (level === 'warning') return <AlertTriangle {...props} />;
  return                          <Info          {...props} />;
}

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotifRow({
  n, isDark, onClick,
}: { n: Notification; isDark: boolean; onClick: () => void }) {
  const c = NOTIF_COLORS[n.level][isDark ? 'dark' : 'light'];

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-all duration-150 hover:opacity-90 group"
      style={{
        background: n.isRead
          ? 'transparent'
          : isDark ? `${c.bg}` : `${c.bg}`,
        borderBottom: isDark
          ? '1px solid rgba(255,255,255,0.05)'
          : '1px solid rgba(99,102,241,0.07)',
      }}
    >
      {/* ── Severity Icon ── */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: c.bg,
          border: `1px solid ${c.border}`,
          opacity: n.isRead ? 0.55 : 1,
        }}
      >
        <LevelIcon level={n.level} color={c.text} />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className="text-sm font-bold truncate"
            style={{
              color: n.isRead
                ? (isDark ? 'rgba(255,255,255,0.45)' : '#9ca3af')
                : (isDark ? 'rgba(255,255,255,0.92)' : '#1e1b4b'),
            }}
          >
            {n.title}
          </p>
          {!n.isRead && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: c.text, boxShadow: isDark ? `0 0 6px ${c.text}` : 'none' }}
            />
          )}
        </div>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: isDark ? 'rgba(255,255,255,0.50)' : '#6b7280' }}
        >
          {n.body}
        </p>
        <p className="text-xs mt-1" style={{ color: c.text, opacity: n.isRead ? 0.5 : 0.8 }}>
          {new Date(n.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Arrow ── */}
      {n.link && !n.isRead && (
        <ArrowUpRight className="w-3.5 h-3.5 shrink-0 mt-1 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: c.text }} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'unread' | 'danger' | 'warning';

export default function NotificationsPage() {
  const { theme }                                    = useAppContext();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [, setLocation]                              = useLocation();
  const [filter, setFilter]                          = useState<FilterType>('all');
  const isDark = theme === 'dark';

  const filtered = (() => {
    if (filter === 'unread')  return notifications.filter(n => !n.isRead);
    if (filter === 'danger')  return notifications.filter(n => n.level === 'danger');
    if (filter === 'warning') return notifications.filter(n => n.level === 'warning');
    return notifications;
  })();

  const titleColor = isDark ? '#ffffff' : '#1e1b4b';
  const muted      = isDark ? 'rgba(255,255,255,0.42)' : '#6b7280';
  const bg         = isDark ? 'rgba(255,255,255,0.024)' : 'rgba(255,255,255,0.72)';
  const brd        = isDark ? '1px solid rgba(0,240,255,0.09)' : '1px solid rgba(99,102,241,0.13)';

  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all',     label: 'الكل',    count: notifications.length },
    { key: 'unread',  label: 'غير مقروء', count: unreadCount },
    { key: 'danger',  label: 'عاجل',    count: notifications.filter(n => n.level === 'danger').length },
    { key: 'warning', label: 'تحذير',   count: notifications.filter(n => n.level === 'warning').length },
  ];

  const handleClick = (n: Notification) => {
    markRead(n.id);
    if (n.link) setLocation(n.link);
  };

  return (
    <div className="space-y-5 p-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isDark ? 'rgba(255,0,128,0.10)' : 'rgba(236,72,153,0.08)',
              border: isDark ? '1px solid rgba(255,0,128,0.25)' : '1px solid rgba(236,72,153,0.20)',
            }}
          >
            <Bell className="w-5 h-5" style={{ color: isDark ? '#ff4da6' : '#be185d' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: titleColor }}>التنبيهات</h1>
            <p className="text-sm mt-0.5" style={{ color: muted }}>
              {unreadCount > 0 ? `${unreadCount} تنبيه غير مقروء` : 'كل التنبيهات مقروءة'}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            onClick={markAllRead}
            variant="ghost"
            className="gap-2 rounded-xl text-xs font-bold h-8 px-3"
            style={{
              color: isDark ? '#00f0ff' : '#6366f1',
              border: isDark ? '1px solid rgba(0,240,255,0.20)' : '1px solid rgba(99,102,241,0.20)',
              background: isDark ? 'rgba(0,240,255,0.05)' : 'rgba(99,102,241,0.05)',
            }}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            تحديد الكل كمقروء
          </Button>
        )}
      </div>

      {/* ── Filter Pills ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-3.5 h-3.5" style={{ color: muted }} />
        {filters.map(f => {
          const active = filter === f.key;
          const col = f.key === 'danger'
            ? (isDark ? '#ff4da6' : '#be185d')
            : f.key === 'warning'
            ? (isDark ? '#fbbf24' : '#d97706')
            : (isDark ? '#00f0ff' : '#6366f1');
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: active ? (isDark ? `${col}20` : `${col}14`) : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.60)'),
                border: active ? `1px solid ${col}60` : (isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(99,102,241,0.12)'),
                color: active ? col : muted,
                boxShadow: active ? `0 0 10px ${col}18` : 'none',
              }}
            >
              {f.label}
              {f.count !== undefined && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    background: active ? `${col}28` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
                    color: active ? col : muted,
                  }}
                >
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Notifications List ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: bg, border: brd }}>
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: isDark ? '#00f0ff' : '#6366f1' }} />
            <p className="text-sm" style={{ color: muted }}>لا توجد تنبيهات في هذه الفئة</p>
          </div>
        ) : (
          filtered.map(n => (
            <NotifRow key={n.id} n={n} isDark={isDark} onClick={() => handleClick(n)} />
          ))
        )}
      </div>
    </div>
  );
}
