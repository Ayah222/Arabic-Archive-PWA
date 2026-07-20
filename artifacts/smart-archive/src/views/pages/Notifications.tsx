import { useNotifications } from "../../controllers/useNotifications";
import EmptyState from "../components/shared/EmptyState";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_COLORS,
  formatRelativeDate,
  type NotificationType,
} from "../../models/types";

export default function Notifications() {
  const { list, markRead, unreadCount, markAllRead } = useNotifications();

  const { data: notifications, isLoading } = list;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الإشعارات</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{unreadCount} إشعار غير مقروء</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-primary hover:underline font-medium"
          >
            قراءة الكل
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !notifications?.length ? (
        <EmptyState
          icon="🔔"
          title="لا توجد إشعارات"
          description="ستظهر هنا جميع التذكيرات والإشعارات"
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.read) {
                  markRead.mutate({ nid: n.id, data: { read: true } });
                }
              }}
              className={`bg-card rounded-2xl p-4 border shadow-sm transition-all duration-200 cursor-pointer ${
                n.read
                  ? "border-border opacity-70"
                  : "border-primary/30 bg-accent/30 hover:border-primary"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {n.type === "reminder" && <span className="text-xl">🔔</span>}
                  {n.type === "info" && <span className="text-xl">ℹ️</span>}
                  {n.type === "warning" && <span className="text-xl">⚠️</span>}
                  {n.type === "success" && <span className="text-xl">✅</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm font-semibold ${n.read ? "text-muted-foreground" : "text-foreground"}`}>
                      {n.title}
                    </h3>
                    {!n.read && (
                      <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NOTIFICATION_TYPE_COLORS[n.type as NotificationType]}`}>
                      {NOTIFICATION_TYPE_LABELS[n.type as NotificationType]}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatRelativeDate(n.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
