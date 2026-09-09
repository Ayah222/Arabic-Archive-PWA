import { useState, useEffect, useCallback } from "react";
import { useAuditLog, getCurrentUser, getUserRequestHeaders } from "../../controllers/useGlobal";
import { useLanguage } from "../../contexts/LanguageContext";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import Toast from "../components/shared/Toast";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api/sa";

interface Profile {
  id: string;
  email: string;
  role: string;
  status: string;
  hr_access?: boolean;
}

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  admin:       { ar: "مدير",                en: "Admin" },
  data_entry:  { ar: "مسؤول إدخال",         en: "Data entry" },
  viewer:      { ar: "موظف مراقب",          en: "Viewer" },
};

const STATUS_COLORS: Record<string, string> = {
  active:  "text-green-600 bg-green-500/10 border-green-500/25",
  pending: "text-yellow-600 bg-yellow-500/10 border-yellow-500/25",
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  active:  { ar: "نشط",              en: "Active" },
  pending: { ar: "بانتظار الموافقة", en: "Pending" },
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
  const { lang } = useLanguage();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const { data: auditLogs, isLoading: auditLoading } = useAuditLog(undefined, 100);
  const [tab, setTab] = useState<"users" | "audit">("users");

  // Profiles from Supabase
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const res = await fetch(`${API}/profiles`);
      const data = await res.json();
      setProfiles(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setProfilesLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("data_entry");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`${API}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getUserRequestHeaders() },
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

  // Update profile (role, status, or HR access)
  const updateProfile = async (id: string, updates: Partial<Pick<Profile, "role" | "status" | "hr_access">>) => {
    const res = await fetch(`${API}/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getUserRequestHeaders() },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated: Profile & { activationEmailSent?: boolean } = await res.json();
      setProfiles(prev => prev.map(p => p.id === id ? updated : p));
      if (updates.status === "active") {
        setToast({
          message: updated.activationEmailSent === false
            ? "تم تفعيل المستخدم، لكن تعذر إرسال رسالة التفعيل"
            : "تم تفعيل المستخدم وإرسال رسالة التفعيل",
          type: updated.activationEmailSent === false ? "error" : "success",
        });
      }
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSaveRole = async (id: string) => {
    if (!newRole) return;
    await updateProfile(id, { role: newRole });
    setEditingId(null);
  };

  const rejectInvitation = async () => {
    if (!profileToDelete) return;
    setDeleteLoading(true);
    const res = await fetch(`${API}/profiles/${profileToDelete.id}`, {
      method: "DELETE",
      headers: getUserRequestHeaders(),
    });
    if (res.ok) {
      setProfiles((current) => current.filter((item) => item.id !== profileToDelete.id));
      setToast({ message: "تم حذف طلب الدعوة والحساب", type: "success" });
      setProfileToDelete(null);
    } else {
      setToast({ message: "تعذر حذف طلب الدعوة", type: "error" });
    }
    setDeleteLoading(false);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-4xl mb-3">🔒</p>
        <p>هذه الصفحة للمسؤولين فقط</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmDialog
        isOpen={!!profileToDelete}
        onClose={() => setProfileToDelete(null)}
        onConfirm={() => void rejectInvitation()}
        title="حذف طلب الدعوة"
        message={`سيتم حذف طلب الدعوة وحساب ${profileToDelete?.email || ""} نهائياً. هل تريد المتابعة؟`}
        confirmLabel="حذف"
        danger
        loading={deleteLoading}
      />

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
                  <option value="data_entry">مسؤول إدخال</option>
                  <option value="viewer">موظف مراقب</option>
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
          <p className="text-sm text-muted-foreground mt-1">تفعيل الحسابات وضبط الصلاحيات</p>
        </div>
        <button onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          + دعوة مستخدم
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab("users")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "users" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
          المستخدمون
        </button>
        <button onClick={() => setTab("audit")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "audit" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
          سجل النشاط
        </button>
      </div>

      {/* Users Table */}
      {tab === "users" && (
        <div className="space-y-3">
          {profilesLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse bg-muted" />)
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">لا يوجد مستخدمون حتى الآن</p>
          ) : (
            profiles.map((profile) => (
              <div key={profile.id} className="liquid-glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                {/* Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-secondary shrink-0">
                    {profile.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{profile.email}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border mt-0.5 inline-block ${STATUS_COLORS[profile.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {STATUS_LABELS[profile.status]?.[lang] ?? profile.status}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Role */}
                  {profile.status === "active" && editingId === profile.id ? (
                    <div className="flex items-center gap-2">
                      <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="data_entry">{ROLE_LABELS.data_entry[lang]}</option>
                        <option value="viewer">{ROLE_LABELS.viewer[lang]}</option>
                        <option value="admin">{ROLE_LABELS.admin[lang]}</option>
                      </select>
                      <button onClick={() => handleSaveRole(profile.id)}
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">حفظ</button>
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 bg-secondary rounded-lg text-xs">إلغاء</button>
                    </div>
                  ) : profile.status === "active" ? (
                    <button onClick={() => { setEditingId(profile.id); setNewRole(profile.role); }}
                      className="text-xs px-2.5 py-1 rounded-full border font-semibold text-muted-foreground border-border hover:text-foreground transition-colors">
                      {ROLE_LABELS[profile.role]?.[lang] ?? profile.role} ✏️
                    </button>
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full border font-semibold text-muted-foreground border-border">
                      {ROLE_LABELS[profile.role]?.[lang] ?? "سيُحدد بعد التفعيل"}
                    </span>
                  )}

                  {/* Approve / Suspend */}
                  {profile.status === "pending" && (
                    <>
                      <button onClick={() => updateProfile(profile.id, { status: "active" })}
                        className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors">
                        ✅ تفعيل
                      </button>
                      <button onClick={() => setProfileToDelete(profile)}
                        className="px-3 py-1.5 bg-red-500/15 text-red-600 border border-red-500/25 rounded-lg text-xs font-semibold hover:bg-red-500/25 transition-colors">
                        ✖ رفض
                      </button>
                    </>
                  )}
                  {profile.status === "active" && (
                    <button onClick={() => updateProfile(profile.id, { status: "pending" })}
                      className="px-3 py-1.5 bg-yellow-500/20 text-yellow-600 border border-yellow-500/30 rounded-lg text-xs font-semibold hover:bg-yellow-500/30 transition-colors">
                      🧊 تجميد
                    </button>
                  )}

                  {/* HR access toggle */}
                  {profile.status === "active" && profile.role !== "admin" && (
                    <button
                      onClick={() => updateProfile(profile.id, { hr_access: !profile.hr_access })}
                      title="السماح بالوصول إلى وحدة الموارد البشرية"
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        profile.hr_access
                          ? "bg-cyan-500/15 text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/25"
                          : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                      }`}>
                      {profile.hr_access ? "✅ صلاحية الموارد البشرية" : "منح صلاحية الموارد البشرية"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Audit Log */}
      {tab === "audit" && (
        <div className="space-y-2">
          {auditLoading ? (
            [...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse bg-muted" />)
          ) : !auditLogs?.length ? (
            <p className="text-sm text-muted-foreground">لا يوجد سجل نشاط</p>
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
