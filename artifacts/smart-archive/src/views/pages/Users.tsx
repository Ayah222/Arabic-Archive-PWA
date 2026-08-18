import { useState } from "react";
import { useUsers, useAuthActions, useAuditLog, getCurrentUser } from "../../controllers/useGlobal";
import { useLanguage } from "../../contexts/LanguageContext";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api/sa";

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  admin:      { ar: "مدير",           en: "Admin" },
  data_entry: { ar: "موظف إدخال",     en: "Data Entry" },
  viewer:     { ar: "عرض فقط",        en: "Viewer" },
};

const ROLE_COLORS: Record<string, string> = {
  admin:      "text-cyan-400 bg-cyan-400/10 border-cyan-400/25",
  data_entry: "text-purple-400 bg-purple-400/10 border-purple-400/25",
  viewer:     "text-muted-foreground bg-muted border-border",
};

const ACTION_LABELS: Record<string, { ar: string; en: string }> = {
  create: { ar: "إضافة", en: "Create" },
  update: { ar: "تعديل", en: "Update" },
  delete: { ar: "حذف",   en: "Delete" },
};

const ACTION_COLORS: Record<string, string> = {
  create: "text-green-400",
  update: "text-blue-400",
  delete: "text-red-400",
};

export default function UsersPage() {
  const { t, lang } = useLanguage();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: auditLogs, isLoading: auditLoading } = useAuditLog(undefined, 100);
  const { changeRole } = useAuthActions();
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("employee");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`${API}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل إرسال الدعوة");
      setInviteMsg({ ok: true, text: "تم إرسال الدعوة بنجاح ✅" });
      setInviteEmail("");
      setTimeout(() => { setInviteOpen(false); setInviteMsg(null); }, 1500);
    } catch (err: any) {
      setInviteMsg({ ok: false, text: err.message });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSaveRole = async (userId: string) => {
    if (!newRole) return;
    try {
      await changeRole.mutateAsync({ id: userId, role: newRole });
      setEditingId(null);
    } catch { /* ignore */ }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-4xl mb-3">🔒</p>
        <p>{t("adminOnly")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setInviteOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">دعوة مستخدم جديد</h2>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">البريد الإلكتروني</label>
                <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="example@company.com"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">الصلاحية</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="employee">موظف</option>
                  <option value="admin">مدير / Admin</option>
                </select>
              </div>
              {inviteMsg && (
                <p className={`text-sm rounded-xl px-3 py-2 ${inviteMsg.ok ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>{inviteMsg.text}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={inviteLoading}
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-60">
                  {inviteLoading ? "جاري الإرسال..." : "إرسال الدعوة"}
                </button>
                <button type="button" onClick={() => setInviteOpen(false)}
                  className="px-4 py-2 bg-secondary rounded-xl text-sm">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("users")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("usersSub")}</p>
        </div>
        <button onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          <span>+</span> دعوة مستخدم
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("users")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "users" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
          {t("usersTab")}
        </button>
        <button onClick={() => setTab("audit")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "audit" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
          {t("auditTab")}
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
                      <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="admin">{ROLE_LABELS.admin[lang]}</option>
                        <option value="data_entry">{ROLE_LABELS.data_entry[lang]}</option>
                        <option value="viewer">{ROLE_LABELS.viewer[lang]}</option>
                      </select>
                      <button onClick={() => handleSaveRole(user.id)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">{t("save")}</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-secondary rounded-lg text-xs">{t("cancelBtn")}</button>
                    </div>
                  ) : (
                    <>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${ROLE_COLORS[user.role] ?? ""}`}>
                        {ROLE_LABELS[user.role]?.[lang] ?? user.role}
                      </span>
                      {user.id !== currentUser?.id && (
                        <button onClick={() => { setEditingId(user.id); setNewRole(user.role); }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                          {t("changeRole")}
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
            <p className="text-sm text-muted-foreground">{t("noAudit")}</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-xl p-3 bg-card border border-border text-sm">
                <span className={`font-bold shrink-0 ${ACTION_COLORS[log.action] ?? ""}`}>
                  {ACTION_LABELS[log.action]?.[lang] ?? log.action}
                </span>
                <span className="flex-1 truncate text-foreground">{log.description}</span>
                <span className="text-xs text-muted-foreground shrink-0">{log.userLabel}</span>
                <span className="text-xs text-muted-foreground shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
