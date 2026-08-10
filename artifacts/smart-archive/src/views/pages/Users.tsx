// Supabase-backed user management panel (super_admin / admin only)
import { useState } from "react";
import {
  useUsers,
  useUserActions,
  useAuditLog,
  getCurrentUser,
} from "../../controllers/useGlobal";
import { UserPlus, Shield, ShieldOff, Trash2, Pencil, X, Check } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "مدير رئيسي",
  admin: "مدير",
  employee: "موظف",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  admin: "text-cyan-400 bg-cyan-400/10 border-cyan-400/25",
  employee: "text-purple-400 bg-purple-400/10 border-purple-400/25",
};

const ACTION_COLORS: Record<string, string> = {
  create: "text-green-400",
  update: "text-blue-400",
  delete: "text-red-400",
};

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  role: string;
  can_upload: boolean;
  is_active: boolean;
  access_expires_at: string | null;
  created_at: string;
}

interface InviteForm {
  email: string;
  full_name: string;
  job_title: string;
  role: string;
  can_upload: boolean;
  access_expires_at: string;
}

export default function UsersPage() {
  const currentUser = getCurrentUser();
  const isAdmin =
    currentUser?.role === "super_admin" || currentUser?.role === "admin";

  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: auditLogs, isLoading: auditLoading } = useAuditLog(undefined, 100);
  const { invite, updateUser, deleteUser } = useUserActions();

  const [tab, setTab] = useState<"users" | "audit">("users");
  const [showInvite, setShowInvite] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: "",
    full_name: "",
    job_title: "",
    role: "employee",
    can_upload: true,
    access_expires_at: "",
  });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-64 text-muted-foreground" dir="rtl">
        <p className="text-4xl mb-3">🔒</p>
        <p>هذه الصفحة مخصصة للمدير فقط</p>
      </div>
    );
  }

  const handleInvite = async () => {
    setInviteError(null);
    setInviteSuccess(null);
    if (!inviteForm.email.trim()) {
      setInviteError("البريد الإلكتروني مطلوب");
      return;
    }
    try {
      await invite.mutateAsync({
        email: inviteForm.email.trim(),
        full_name: inviteForm.full_name.trim() || undefined,
        job_title: inviteForm.job_title.trim() || undefined,
        role: inviteForm.role,
        can_upload: inviteForm.can_upload,
        access_expires_at: inviteForm.access_expires_at || null,
      });
      setInviteSuccess(`تم إرسال دعوة إلى ${inviteForm.email}`);
      setInviteForm({
        email: "",
        full_name: "",
        job_title: "",
        role: "employee",
        can_upload: true,
        access_expires_at: "",
      });
      setTimeout(() => {
        setShowInvite(false);
        setInviteSuccess(null);
      }, 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "حدث خطأ أثناء إرسال الدعوة";
      try { setInviteError((JSON.parse(msg) as { error?: string }).error ?? msg); }
      catch { setInviteError(msg); }
    }
  };

  const startEdit = (user: UserProfile) => {
    setEditingId(user.id);
    setEditForm({
      role: user.role,
      can_upload: user.can_upload,
      is_active: user.is_active,
      full_name: user.full_name ?? "",
      job_title: user.job_title ?? "",
      access_expires_at: user.access_expires_at ?? "",
    });
  };

  const saveEdit = async (uid: string) => {
    try {
      await updateUser.mutateAsync({
        uid,
        data: {
          role: editForm.role,
          can_upload: editForm.can_upload,
          is_active: editForm.is_active,
          full_name: editForm.full_name || undefined,
          job_title: editForm.job_title || undefined,
          access_expires_at: editForm.access_expires_at || null,
        },
      });
      setEditingId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطأ في الحفظ";
      try { alert((JSON.parse(msg) as { error?: string }).error ?? msg); }
      catch { alert(msg); }
    }
  };

  const handleDelete = async (uid: string, email: string) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${email}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    try {
      await deleteUser.mutateAsync(uid);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطأ في الحذف";
      try { alert((JSON.parse(msg) as { error?: string }).error ?? msg); }
      catch { alert(msg); }
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين والصلاحيات</h1>
          <p className="text-sm text-muted-foreground mt-1">دعوة موظفين وضبط الصلاحيات وسجل التدقيق</p>
        </div>
        {tab === "users" && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(0,240,255,0.15) 0%, rgba(112,0,255,0.15) 100%)",
              border: "1px solid rgba(0,240,255,0.30)",
              color: "#00f0ff",
            }}
          >
            <UserPlus className="w-4 h-4" />
            دعوة موظف
          </button>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "rgba(10,8,22,0.97)", border: "1px solid rgba(0,240,255,0.15)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">دعوة موظف جديد</h2>
              <button onClick={() => { setShowInvite(false); setInviteError(null); setInviteSuccess(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">البريد الإلكتروني * (Gmail)</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="employee@gmail.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">الاسم الكامل</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  placeholder="محمد أحمد"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">المسمى الوظيفي</label>
                <input
                  type="text"
                  value={inviteForm.job_title}
                  onChange={(e) => setInviteForm({ ...inviteForm, job_title: e.target.value })}
                  placeholder="مهندس معماري"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">نوع الحساب</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="employee">موظف</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">انتهاء الوصول</label>
                  <input
                    type="date"
                    value={inviteForm.access_expires_at}
                    onChange={(e) => setInviteForm({ ...inviteForm, access_expires_at: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    dir="ltr"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteForm.can_upload}
                  onChange={(e) => setInviteForm({ ...inviteForm, can_upload: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">صلاحية رفع الملفات والوثائق</span>
              </label>
            </div>

            {inviteError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{inviteError}</p>
            )}
            {inviteSuccess && (
              <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">{inviteSuccess}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void handleInvite()}
                disabled={invite.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.2), rgba(112,0,255,0.2))", border: "1px solid rgba(0,240,255,0.3)", color: "#00f0ff" }}
              >
                {invite.isPending ? "جاري الإرسال..." : "إرسال الدعوة"}
              </button>
              <button
                onClick={() => { setShowInvite(false); setInviteError(null); }}
                className="px-4 py-2.5 rounded-xl text-sm bg-secondary text-secondary-foreground"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(["users", "audit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
          >
            {t === "users" ? "المستخدمون" : "سجل التدقيق"}
          </button>
        ))}
      </div>

      {/* Users list */}
      {tab === "users" && (
        <div className="space-y-3">
          {usersLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse bg-muted" />)
          ) : !users?.length ? (
            <p className="text-sm text-muted-foreground">لا يوجد مستخدمون بعد. استخدم «دعوة موظف» لإضافة أعضاء الفريق.</p>
          ) : (
            (users as UserProfile[]).map((user) => (
              <div key={user.id} className="liquid-glass-card rounded-2xl p-4 space-y-3">
                {editingId === user.id ? (
                  /* ── Edit mode ── */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">{user.email}</p>
                      <div className="flex gap-2">
                        <button onClick={() => void saveEdit(user.id)} disabled={updateUser.isPending} className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/20 text-green-400 hover:bg-green-500/30">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">الاسم</label>
                        <input value={editForm.full_name ?? ""} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">المسمى الوظيفي</label>
                        <input value={editForm.job_title ?? ""} onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">الدور</label>
                        <select value={editForm.role ?? "employee"} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                          {currentUser?.role === "super_admin" && <option value="super_admin">مدير رئيسي</option>}
                          <option value="admin">مدير</option>
                          <option value="employee">موظف</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">انتهاء الوصول</label>
                        <input type="date" value={editForm.access_expires_at ?? ""} onChange={(e) => setEditForm({ ...editForm, access_expires_at: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={editForm.can_upload ?? true} onChange={(e) => setEditForm({ ...editForm, can_upload: e.target.checked })} className="w-4 h-4 rounded" />
                        رفع ملفات
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={editForm.is_active ?? true} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="w-4 h-4 rounded" />
                        حساب مفعّل
                      </label>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-secondary shrink-0">
                      {(user.full_name ?? user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{user.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{user.email}</p>
                      {user.job_title && <p className="text-xs text-muted-foreground">{user.job_title}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${ROLE_COLORS[user.role] ?? ""}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                      {!user.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">مجمّد</span>
                      )}
                      {user.id !== currentUser?.id && (
                        <>
                          <button onClick={() => startEdit(user)} title="تعديل" className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => void updateUser.mutateAsync({ uid: user.id, data: { is_active: !user.is_active } })}
                            title={user.is_active ? "تجميد" : "تفعيل"}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${user.is_active ? "text-yellow-400 hover:bg-yellow-400/10" : "text-green-400 hover:bg-green-400/10"}`}
                          >
                            {user.is_active ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                          </button>
                          {currentUser?.role === "super_admin" && (
                            <button
                              onClick={() => void handleDelete(user.id, user.email)}
                              title="حذف"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-400/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Audit log */}
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
                  {{ create: "إضافة", update: "تعديل", delete: "حذف" }[log.action] ?? log.action}
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
