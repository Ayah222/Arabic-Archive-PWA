import { useState, useEffect, useCallback } from "react";
import { useAuditLog, getCurrentUser, getUserRequestHeaders } from "../../controllers/useGlobal";
import { useLanguage } from "../../contexts/LanguageContext";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import Toast from "../components/shared/Toast";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api/sa";

interface Profile {
  id: string;
  email: string;
  name?: string | null;
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
  pending: { ar: "بانتظار قبول الدعوة", en: "Awaiting invitation" },
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
  const [profilesError, setProfilesError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setProfilesLoading(true);
    setProfilesError(null);
    try {
      const res = await fetch(`${API}/profiles`, { credentials: "include" });
      const data: unknown = await res.json();
      if (!res.ok) {
        const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "تعذر تحميل قائمة المستخدمين";
        throw new Error(message);
      }
      if (!Array.isArray(data)) throw new Error("استجابة قائمة المستخدمين غير صالحة");
      setProfiles(data);
    } catch (error) {
      setProfilesError(error instanceof Error ? error.message : "تعذر تحميل قائمة المستخدمين");
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("data_entry");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [linkLoadingId, setLinkLoadingId] = useState<string | null>(null);

  const closeInvite = () => {
    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteMsg(null);
    setInviteLink("");
    setInviteCopied(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`${API}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getUserRequestHeaders() },
        body: JSON.stringify({ name: inviteName, email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل إنشاء رابط الدعوة");
      if (typeof data.inviteLink !== "string" || !data.inviteLink) {
        throw new Error("تم إنشاء الحساب لكن لم يصل رابط الدعوة من الخادم.");
      }
      setInviteLink(data.inviteLink);
      void fetchProfiles();
    } catch (err: any) {
      setInviteMsg({ ok: false, text: err.message });
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
    } catch {
      setInviteMsg({ ok: false, text: "تعذر النسخ تلقائياً. حددي الرابط وانسخيه يدوياً." });
    }
  };

  const openInviteEmailDraft = () => {
    const subject = `دعوة للانضمام إلى أرشيف ذكي`;
    const body = `مرحباً ${inviteName}،\n\nتمت دعوتك للانضمام إلى أرشيف المؤسسة. افتح الرابط التالي لتعيين كلمة المرور وتفعيل حسابك:\n\n${inviteLink}\n\nإذا لم تطلب هذه الدعوة، يمكنك تجاهل هذه الرسالة.`;
    window.location.href = `mailto:${encodeURIComponent(inviteEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const createFreshInviteLink = async (profile: Profile) => {
    setLinkLoadingId(profile.id);
    try {
      const res = await fetch(`${API}/profiles/${profile.id}/invite-link`, {
        method: "POST",
        credentials: "include",
        headers: getUserRequestHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذر إنشاء رابط جديد");
      if (typeof data.inviteLink !== "string" || !data.inviteLink) {
        throw new Error("لم يصل رابط التفعيل من الخادم.");
      }
      setInviteName(profile.name?.trim() || profile.email);
      setInviteEmail(profile.email);
      setInviteMsg(null);
      setInviteLink(data.inviteLink);
      setInviteCopied(false);
      setInviteOpen(true);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "تعذر إنشاء رابط جديد",
        type: "error",
      });
    } finally {
      setLinkLoadingId(null);
    }
  };

  // Update profile (role, status, or HR access)
  const updateProfile = async (id: string, updates: Partial<Pick<Profile, "role" | "status" | "hr_access">>) => {
    try {
      const res = await fetch(`${API}/profiles/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getUserRequestHeaders() },
        body: JSON.stringify(updates),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "تعذر حفظ التغييرات";
        throw new Error(message);
      }
      const updated = data as Profile & { activationEmailSent?: boolean };
      setProfiles(prev => prev.map(p => p.id === id ? updated : p));
      if (updates.status === "active") {
        setToast({
          message: updated.activationEmailSent === true
            ? (lang === "en" ? "User activated and activation email sent" : "تم تفعيل المستخدم وإرسال رسالة التفعيل")
            : updated.activationEmailSent === false
              ? (lang === "en" ? "User activated, but the activation email could not be sent" : "تم تفعيل المستخدم، لكن تعذر إرسال رسالة التفعيل")
              : (lang === "en" ? "Organization membership activated" : "تم تفعيل عضوية المؤسسة"),
          type: updated.activationEmailSent === false ? "error" : "success",
        });
      }
      return true;
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "تعذر حفظ التغييرات",
        type: "error",
      });
      return false;
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSaveRole = async (id: string) => {
    if (!newRole) return;
    if (await updateProfile(id, { role: newRole })) {
      setEditingId(null);
      setToast({ message: lang === "en" ? "User role updated" : "تم تحديث صلاحية المستخدم", type: "success" });
    }
  };

  const deleteUser = async () => {
    if (!profileToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API}/profiles/${profileToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getUserRequestHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذر حذف المستخدم");
      setProfiles((current) => current.filter((item) => item.id !== profileToDelete.id));
      setToast({
        message: data.deletedAuthUser
          ? "تم حذف المستخدم وحسابه من النظام"
          : "تمت إزالة المستخدم من هذه المؤسسة",
        type: "success",
      });
      setProfileToDelete(null);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "تعذر حذف المستخدم", type: "error" });
    } finally {
      setDeleteLoading(false);
    }
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
        onConfirm={() => void deleteUser()}
        title="حذف المستخدم"
        message={`سيتم حذف ${profileToDelete?.name || profileToDelete?.email || "المستخدم"} من مؤسستك. إذا لم يكن تابعاً لمؤسسة أخرى، سيفقد إمكانية الدخول إلى النظام. لن تُحذف ملفات الأرشيف. هل تريد المتابعة؟`}
        confirmLabel="حذف"
        danger
        loading={deleteLoading}
      />

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeInvite}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">{inviteLink ? "رابط دعوة الموظف جاهز" : "إنشاء دعوة موظف"}</h2>
            {inviteLink ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  لم يُرسل النظام بريداً تلقائياً. انسخي الرابط وأرسليه للموظف عبر Gmail أو واتساب. عند فتحه، سيختار الموظف كلمة المرور ويكمل تفعيل الحساب.
                </p>
                <textarea
                  readOnly
                  value={inviteLink}
                  aria-label="رابط دعوة الموظف"
                  onFocus={(event) => event.currentTarget.select()}
                  className="w-full h-24 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs break-all"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">هذا رابط خاص لمرة واحدة؛ أرسليه إلى الموظف المدعو فقط.</p>
                {inviteMsg && <p className="text-sm text-red-500">{inviteMsg.text}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyInviteLink()}
                    className="flex-1 min-w-[120px] py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">
                    {inviteCopied ? "تم نسخ الرابط" : "نسخ الرابط"}
                  </button>
                  <button type="button" onClick={openInviteEmailDraft}
                    className="flex-1 min-w-[120px] py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold">
                    فتح رسالة بريد جاهزة
                  </button>
                  <button type="button" onClick={closeInvite}
                    className="px-4 py-2 border border-border rounded-xl text-sm">إغلاق</button>
                </div>
              </div>
            ) : (
            <>
            <p className="text-xs text-muted-foreground">سينشئ النظام رابطاً آمناً؛ انسخيه بعد ذلك وأرسليه للموظف بنفسك عبر البريد أو واتساب. لا يحتاج ذلك إلى إعداد SMTP أو إرسال تلقائي.</p>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">اسم المستخدم</label>
                <input type="text" required maxLength={120} value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                  placeholder="اسم الموظف أو المدير"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
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
                <p className="text-sm rounded-xl px-3 py-2 bg-red-500/10 text-red-500">{inviteMsg.text}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={inviteLoading}
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-60">
                  {inviteLoading ? "جاري إنشاء الرابط..." : "إنشاء رابط الدعوة"}
                </button>
                <button type="button" onClick={closeInvite}
                  className="px-4 py-2 bg-secondary rounded-xl text-sm">إلغاء</button>
              </div>
            </form>
            </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
          <p className="text-sm text-muted-foreground mt-1">تفعيل الحسابات وضبط الصلاحيات</p>
        </div>
        <button onClick={() => { setInviteMsg(null); setInviteOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          + إضافة موظف
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
          ) : profilesError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center" data-testid="status-users-load-error">
              <p className="text-sm text-red-700 dark:text-red-300">{profilesError}</p>
              <button
                onClick={() => void fetchProfiles()}
                data-testid="button-retry-users"
                className="mt-3 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-muted">
                {lang === "en" ? "Retry" : "إعادة المحاولة"}
              </button>
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">لا يوجد مستخدمون حتى الآن</p>
          ) : (
            profiles.map((profile) => (
              <div key={profile.id} className="liquid-glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                {/* Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-secondary shrink-0">
                    {(profile.name?.trim() || profile.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {profile.name?.trim() && <p className="font-semibold text-sm truncate">{profile.name}</p>}
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
                      <button
                        onClick={() => void createFreshInviteLink(profile)}
                        disabled={linkLoadingId === profile.id}
                        className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold hover:bg-primary/15 transition-colors disabled:opacity-60">
                        {linkLoadingId === profile.id ? "جاري إنشاء الرابط..." : "رابط تفعيل جديد"}
                      </button>
                      <button onClick={() => updateProfile(profile.id, { status: "active" })}
                        className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors">
                        ✅ تفعيل
                      </button>
                    </>
                  )}
                  {profile.status === "active" && (
                    <button onClick={() => updateProfile(profile.id, { status: "pending" })}
                      className="px-3 py-1.5 bg-yellow-500/20 text-yellow-600 border border-yellow-500/30 rounded-lg text-xs font-semibold hover:bg-yellow-500/30 transition-colors">
                      🧊 تجميد
                    </button>
                  )}

                  <button onClick={() => setProfileToDelete(profile)}
                    className="px-3 py-1.5 bg-red-500/15 text-red-600 border border-red-500/25 rounded-lg text-xs font-semibold hover:bg-red-500/25 transition-colors">
                    🗑 حذف
                  </button>

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
