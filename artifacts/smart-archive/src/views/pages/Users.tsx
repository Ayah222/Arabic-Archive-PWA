// Prompt 7: User management (admin only) + Audit log
import { useState } from "react";
import { useUsers, useAuthActions, useAuditLog, getCurrentUser } from "../../controllers/useGlobal";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  data_entry: "موظف إدخال",
  viewer: "عرض فقط",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "text-cyan-400 bg-cyan-400/10 border-cyan-400/25",
  data_entry: "text-purple-400 bg-purple-400/10 border-purple-400/25",
  viewer: "text-muted-foreground bg-muted border-border",
};

const ACTION_LABELS: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
};

const ACTION_COLORS: Record<string, string> = {
  create: "text-green-400",
  update: "text-blue-400",
  delete: "text-red-400",
};

export default function UsersPage() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: auditLogs, isLoading: auditLoading } = useAuditLog(undefined, 100);
  const { changeRole } = useAuthActions();
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  const handleSaveRole = async (userId: string) => {
    if (!newRole) return;
    try {
      await changeRole.mutateAsync({ id: userId, role: newRole });
      setEditingId(null);
    } catch {
      /* ignore */
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-64 text-muted-foreground" dir="rtl">
        <p className="text-4xl mb-3">🔒</p>
        <p>هذه الصفحة مخصصة للمدير فقط</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين والصلاحيات</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة الحسابات والصلاحيات وسجل التدقيق</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "users" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
        >
          المستخدمون
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "audit" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
        >
          سجل التدقيق
        </button>
      </div>

      {tab === "users" && (
        <div className="space-y-3">
          {usersLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse bg-muted" />)
          ) : (
            users?.map((user) => (
              <div key={user.id} className="liquid-glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-secondary">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{user.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === user.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        dir="rtl"
                      >
                        <option value="admin">مدير</option>
                        <option value="data_entry">موظف إدخال</option>
                        <option value="viewer">عرض فقط</option>
                      </select>
                      <button onClick={() => handleSaveRole(user.id)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">حفظ</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-secondary rounded-lg text-xs">إلغاء</button>
                    </div>
                  ) : (
                    <>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${ROLE_COLORS[user.role] ?? ""}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => { setEditingId(user.id); setNewRole(user.role); }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          تغيير
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="space-y-2">
          {auditLoading ? (
            [...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse bg-muted" />)
          ) : !auditLogs?.length ? (
            <p className="text-sm text-muted-foreground">لا توجد سجلات تدقيق بعد</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-xl p-3 bg-card border border-border text-sm">
                <span className={`font-bold shrink-0 ${ACTION_COLORS[log.action] ?? ""}`}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="flex-1 truncate text-foreground">{log.description}</span>
                <span className="text-xs text-muted-foreground shrink-0">{log.userLabel}</span>
                <span className="text-xs text-muted-foreground shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleDateString("ar-SA")}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
