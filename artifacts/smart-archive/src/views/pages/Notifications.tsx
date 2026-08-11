import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../controllers/useNotifications";
import EmptyState from "../components/shared/EmptyState";

const TYPE_ICON: Record<string, string> = {
  reminder: "🔔",
  info:     "ℹ️",
  warning:  "⚠️",
  success:  "✅",
};

const TYPE_LABEL: Record<string, string> = {
  reminder: "تذكير",
  info:     "معلومة",
  warning:  "تنبيه",
  success:  "نجاح",
};

const PRIORITY_COLOR: Record<string, string> = {
  high:   "text-red-400 bg-red-400/10 border-red-400/25",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  low:    "text-cyan-400 bg-cyan-400/10 border-cyan-400/25",
};

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1)  return "الآن";
    if (m < 60) return `منذ ${m} دقيقة`;
    if (h < 24) return `منذ ${h} ساعة`;
    return `منذ ${d} يوم`;
  } catch { return ""; }
}

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, markRead, unreadCount, markAllRead } = useNotifications();

  function handleClick(id: string, actionUrl?: string | null) {
    markRead(id);
    if (actionUrl) navigate(actionUrl);
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الإشعارات</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount} إشعار غير مقروء
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)",
              color: "#fff",
              boxShadow: "0 0 16px rgba(0,240,255,0.25)",
            }}
          >
            قراءة الكل ✓
          </button>
        )}
      </div>

      {/* List */}
      {!notifications.length ? (
        <EmptyState
          icon="🔔"
          title="لا توجد إشعارات"
          description="ستظهر هنا التذكيرات والتنبيهات التلقائية من النظام"
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const extra = n as any;
            const actionUrl: string | null | undefined = extra.actionUrl;
            const createdByName: string | null | undefined = extra.createdByName;
            const isClickable = !n.read || !!actionUrl;

            return (
              <div
                key={n.id}
                onClick={() => handleClick(n.id, actionUrl)}
                className="liquid-glass-card rounded-2xl p-4 transition-all duration-200 hover:opacity-90"
                style={{
                  opacity: n.read ? 0.60 : 1,
                  borderLeft: n.read ? undefined : "3px solid rgba(0,240,255,0.60)",
                  cursor: isClickable ? "pointer" : "default",
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="text-2xl mt-0.5 shrink-0">
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-foreground truncate">{n.title}</p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: "#00f0ff", boxShadow: "0 0 6px #00f0ff" }} />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>

                    {/* Sender name */}
                    {createdByName && (
                      <p className="text-xs text-muted-foreground mt-1 opacity-70">
                        👤 {createdByName}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                        style={{
                          color: "rgba(255,255,255,0.65)",
                          background: "rgba(255,255,255,0.06)",
                          borderColor: "rgba(255,255,255,0.10)",
                        }}>
                        {TYPE_LABEL[n.type] ?? n.type}
                      </span>
                      {n.priority && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_COLOR[n.priority] ?? "text-muted-foreground"}`}>
                          {n.priority === "high" ? "عالي" : n.priority === "medium" ? "متوسط" : "منخفض"}
                        </span>
                      )}
                      {actionUrl && (
                        <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                          style={{
                            color: "rgba(0,240,255,0.80)",
                            background: "rgba(0,240,255,0.06)",
                            borderColor: "rgba(0,240,255,0.20)",
                          }}>
                          انقر للانتقال ↗
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
