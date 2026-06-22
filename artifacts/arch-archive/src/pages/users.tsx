import React, { useState } from "react";
import { useAppContext } from "../context/AppContext";
import {
  Users, Shield, HardHat, Pencil, Calculator,
  UserCheck, Briefcase, Building, Plus, X, Save,
  CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";

// ─── Role Definitions ─────────────────────────────────────────────────────────

type RoleKey = "system_admin" | "project_manager" | "engineer" | "secretary" | "accountant" | "contractor" | "client";

interface UserRole {
  key: RoleKey;
  label: string;
  Icon: React.FC<any>;
  color: string;
  darkColor: string;
  permissions: {
    view_projects: boolean;
    edit_projects: boolean;
    view_docs: boolean;
    upload_docs: boolean;
    delete_docs: boolean;
    view_contractors: boolean;
    edit_contractors: boolean;
    view_letters: boolean;
    send_letters: boolean;
    view_meetings: boolean;
    manage_meetings: boolean;
    manage_users: boolean;
  };
}

const ROLES: Record<RoleKey, UserRole> = {
  system_admin: {
    key: "system_admin", label: "مدير النظام", Icon: Shield,
    color: "#dc2626", darkColor: "#f87171",
    permissions: {
      view_projects: true, edit_projects: true,
      view_docs: true, upload_docs: true, delete_docs: true,
      view_contractors: true, edit_contractors: true,
      view_letters: true, send_letters: true,
      view_meetings: true, manage_meetings: true,
      manage_users: true,
    },
  },
  project_manager: {
    key: "project_manager", label: "مدير المشروع", Icon: Briefcase,
    color: "#0ea5e9", darkColor: "#38bdf8",
    permissions: {
      view_projects: true, edit_projects: true,
      view_docs: true, upload_docs: true, delete_docs: true,
      view_contractors: true, edit_contractors: true,
      view_letters: true, send_letters: true,
      view_meetings: true, manage_meetings: true,
      manage_users: false,
    },
  },
  engineer: {
    key: "engineer", label: "مهندس", Icon: Building,
    color: "#8b5cf6", darkColor: "#a78bfa",
    permissions: {
      view_projects: true, edit_projects: false,
      view_docs: true, upload_docs: true, delete_docs: false,
      view_contractors: true, edit_contractors: false,
      view_letters: true, send_letters: false,
      view_meetings: true, manage_meetings: false,
      manage_users: false,
    },
  },
  secretary: {
    key: "secretary", label: "سكرتارية", Icon: Pencil,
    color: "#f59e0b", darkColor: "#fbbf24",
    permissions: {
      view_projects: true, edit_projects: false,
      view_docs: true, upload_docs: true, delete_docs: false,
      view_contractors: false, edit_contractors: false,
      view_letters: true, send_letters: true,
      view_meetings: true, manage_meetings: true,
      manage_users: false,
    },
  },
  accountant: {
    key: "accountant", label: "محاسب", Icon: Calculator,
    color: "#10b981", darkColor: "#34d399",
    permissions: {
      view_projects: true, edit_projects: false,
      view_docs: true, upload_docs: true, delete_docs: false,
      view_contractors: true, edit_contractors: false,
      view_letters: true, send_letters: false,
      view_meetings: false, manage_meetings: false,
      manage_users: false,
    },
  },
  contractor: {
    key: "contractor", label: "مقاول", Icon: HardHat,
    color: "#f97316", darkColor: "#fb923c",
    permissions: {
      view_projects: true, edit_projects: false,
      view_docs: true, upload_docs: true, delete_docs: false,
      view_contractors: false, edit_contractors: false,
      view_letters: true, send_letters: false,
      view_meetings: false, manage_meetings: false,
      manage_users: false,
    },
  },
  client: {
    key: "client", label: "عميل", Icon: UserCheck,
    color: "#ec4899", darkColor: "#f472b6",
    permissions: {
      view_projects: true, edit_projects: false,
      view_docs: false, upload_docs: false, delete_docs: false,
      view_contractors: false, edit_contractors: false,
      view_letters: false, send_letters: false,
      view_meetings: false, manage_meetings: false,
      manage_users: false,
    },
  },
};

const PERM_LABELS: Record<string, string> = {
  view_projects:     "عرض المشاريع",
  edit_projects:     "تعديل المشاريع",
  view_docs:         "عرض المستندات",
  upload_docs:       "رفع المستندات",
  delete_docs:       "حذف المستندات",
  view_contractors:  "عرض المقاولين",
  edit_contractors:  "تعديل المقاولين",
  view_letters:      "عرض الخطابات",
  send_letters:      "إرسال الخطابات",
  view_meetings:     "عرض الاجتماعات",
  manage_meetings:   "إدارة الاجتماعات",
  manage_users:      "إدارة المستخدمين",
};

// ─── Mock Users ───────────────────────────────────────────────────────────────

interface MockUser {
  id: string;
  name: string;
  username: string;
  role: RoleKey;
  active: boolean;
}

let _users: MockUser[] = [
  { id: "u1", name: "أ. سلطان الغامدي",    username: "admin",          role: "system_admin",    active: true  },
  { id: "u2", name: "م. خالد العمري",       username: "khalid.omari",  role: "project_manager", active: true  },
  { id: "u3", name: "م. فهد السعيد",        username: "fahad.saeed",   role: "engineer",        active: true  },
  { id: "u4", name: "م. نورة الأحمدي",      username: "noura.ahmadi",  role: "engineer",        active: true  },
  { id: "u5", name: "أ. ريم الشهري",        username: "reem.shahri",   role: "secretary",       active: true  },
  { id: "u6", name: "أ. بدر القحطاني",      username: "badr.qahtani",  role: "accountant",      active: true  },
  { id: "u7", name: "م. عمر الزهراني",      username: "omar.zahrani",  role: "contractor",      active: false },
  { id: "u8", name: "أ. سارة الدوسري",      username: "sara.dosari",   role: "client",          active: true  },
];
let _nextUserId = 9;

function useUsers() {
  const [users, setUsers] = useState<MockUser[]>(_users);
  const add = (u: MockUser) => { _users = [..._users, u]; setUsers([..._users]); };
  const toggle = (id: string) => {
    _users = _users.map((u) => u.id === id ? { ...u, active: !u.active } : u);
    setUsers([..._users]);
  };
  const remove = (id: string) => { _users = _users.filter((u) => u.id !== id); setUsers([..._users]); };
  return { users, add, toggle, remove };
}

function emptyUserForm(): { name: string; username: string; role: RoleKey } {
  return { name: "", username: "", role: "engineer" };
}

// ─── Permission Dot ───────────────────────────────────────────────────────────

function Dot({ yes, isDark }: { yes: boolean; isDark: boolean }) {
  return yes
    ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: isDark ? "#34d399" : "#059669" }} />
    : <XCircle    className="w-3.5 h-3.5" style={{ color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" }} />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { theme } = useAppContext();
  const isDark = theme === "dark";
  const { users, add, toggle, remove } = useUsers();

  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyUserForm());
  const [tab, setTab] = useState<"users" | "permissions">("users");

  const titleColor = isDark ? "rgba(255,255,255,0.92)" : "#1e1b4b";
  const muted      = isDark ? "rgba(255,255,255,0.42)" : "#6b7280";
  const body       = isDark ? "rgba(255,255,255,0.78)" : "#374151";
  const bg         = isDark ? "rgba(255,255,255,0.024)" : "rgba(255,255,255,0.72)";
  const brd        = isDark ? "1px solid rgba(0,240,255,0.09)" : "1px solid rgba(99,102,241,0.13)";

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 10,
    border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(99,102,241,0.22)",
    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.80)",
    color: isDark ? "#e2e8f0" : "#1e293b", fontSize: 13,
    outline: "none", fontFamily: "inherit",
  };

  const handleAddUser = () => {
    if (!form.name.trim() || !form.username.trim()) return;
    const newUser: MockUser = {
      id: `u${_nextUserId++}`,
      name: form.name.trim(),
      username: form.username.trim(),
      role: form.role,
      active: true,
    };
    add(newUser);
    setForm(emptyUserForm());
    setShowAdd(false);
  };

  return (
    <div className="space-y-5 p-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black" style={{ color: titleColor }}>المستخدمون والصلاحيات</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>إدارة حسابات المستخدمين وأدوارهم في النظام</p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="gap-2 rounded-xl text-sm font-bold h-9 px-4"
          style={{ background: isDark ? "linear-gradient(135deg,#00f0ff,#818cf8)" : "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", border: "none" }}>
          <Plus className="w-4 h-4" /> إضافة مستخدم
        </Button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        {(["users", "permissions"] as const).map((t) => {
          const active = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: active ? (isDark ? "rgba(0,240,255,0.10)" : "rgba(99,102,241,0.10)") : (isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.60)"),
                border: active ? (isDark ? "1px solid rgba(0,240,255,0.40)" : "1px solid rgba(99,102,241,0.40)") : (isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(99,102,241,0.12)"),
                color: active ? (isDark ? "#00f0ff" : "#6366f1") : muted,
              }}>
              {t === "users" ? `المستخدمون (${users.length})` : "مصفوفة الصلاحيات"}
            </button>
          );
        })}
      </div>

      {/* ── USERS LIST ── */}
      {tab === "users" && (
        <div className="rounded-2xl overflow-hidden" style={{ background: bg, border: brd }}>
          {/* Header Row */}
          <div className="grid grid-cols-[2fr_1.5fr_1.5fr_auto_auto] gap-3 px-4 py-2.5 text-xs font-bold"
            style={{ color: muted, borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(99,102,241,0.08)", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(99,102,241,0.03)" }}>
            <span>الاسم</span>
            <span>اسم المستخدم</span>
            <span>الدور</span>
            <span>الحالة</span>
            <span>حذف</span>
          </div>

          {users.map((u, i) => {
            const role = ROLES[u.role];
            const col = isDark ? role.darkColor : role.color;
            return (
              <div key={u.id}
                className="grid grid-cols-[2fr_1.5fr_1.5fr_auto_auto] gap-3 px-4 py-3 items-center"
                style={{ borderBottom: i < users.length - 1 ? (isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(99,102,241,0.07)") : "none" }}>
                {/* الاسم */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${col}18`, border: `1px solid ${col}30` }}>
                    <role.Icon className="w-4 h-4" style={{ color: col }} />
                  </div>
                  <span className="text-sm font-bold truncate" style={{ color: body }}>{u.name}</span>
                </div>
                {/* username */}
                <span className="text-xs font-mono" style={{ color: muted }}>{u.username}</span>
                {/* role badge */}
                <span className="text-xs font-bold px-2 py-0.5 rounded-full self-center w-fit"
                  style={{ background: `${col}14`, color: col, border: `1px solid ${col}28` }}>
                  {role.label}
                </span>
                {/* toggle active */}
                <button onClick={() => toggle(u.id)}
                  className="px-2 py-0.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: u.active ? (isDark ? "rgba(52,211,153,0.12)" : "rgba(5,150,105,0.08)") : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
                    color: u.active ? (isDark ? "#34d399" : "#059669") : muted,
                    border: u.active ? "1px solid rgba(52,211,153,0.25)" : (isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.08)"),
                  }}>
                  {u.active ? "نشط" : "معطل"}
                </button>
                {/* delete */}
                <button onClick={() => remove(u.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                  style={{ background: isDark ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#f87171" }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PERMISSIONS MATRIX ── */}
      {tab === "permissions" && (
        <div className="space-y-4">
          {/* Role cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.values(ROLES).map((role) => {
              const col = isDark ? role.darkColor : role.color;
              const active = selectedRole === role.key;
              return (
                <button key={role.key}
                  onClick={() => setSelectedRole(active ? null : role.key)}
                  className="rounded-xl p-3 text-start transition-all"
                  style={{
                    background: active ? `${col}18` : bg,
                    border: active ? `1px solid ${col}60` : (isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(99,102,241,0.10)"),
                    boxShadow: active ? `0 0 16px ${col}20` : "none",
                  }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${col}18`, border: `1px solid ${col}30` }}>
                      <role.Icon className="w-3.5 h-3.5" style={{ color: col }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: active ? col : body }}>{role.label}</span>
                  </div>
                  <p className="text-xs" style={{ color: muted }}>
                    {Object.values(role.permissions).filter(Boolean).length} صلاحية
                  </p>
                </button>
              );
            })}
          </div>

          {/* Permissions Table */}
          {selectedRole && (() => {
            const role = ROLES[selectedRole];
            const col = isDark ? role.darkColor : role.color;
            return (
              <div className="rounded-2xl overflow-hidden" style={{ background: bg, border: `1px solid ${col}30` }}>
                <div className="px-4 py-3 flex items-center gap-2"
                  style={{ background: `${col}10`, borderBottom: `1px solid ${col}20` }}>
                  <role.Icon className="w-4 h-4" style={{ color: col }} />
                  <span className="text-sm font-bold" style={{ color: col }}>صلاحيات {role.label}</span>
                </div>
                <div className="divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(99,102,241,0.07)" }}>
                  {Object.entries(role.permissions).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm" style={{ color: body }}>{PERM_LABELS[key] || key}</span>
                      <Dot yes={val} isDark={isDark} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {!selectedRole && (
            <p className="text-sm text-center py-6" style={{ color: muted }}>اختر دوراً من الأعلى لعرض صلاحياته</p>
          )}
        </div>
      )}

      {/* ── Add User Dialog ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: isDark ? "rgba(15,10,30,0.95)" : "rgba(255,255,255,0.97)", border: isDark ? "1px solid rgba(0,240,255,0.15)" : "1px solid rgba(99,102,241,0.20)", boxShadow: "0 30px 80px rgba(0,0,0,0.70)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black" style={{ color: titleColor }}>إضافة مستخدم جديد</h2>
              <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded-xl flex items-center justify-center hover:opacity-70" style={{ color: muted }}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>الاسم الكامل *</label>
                <input style={inp} placeholder="مثال: م. أحمد المطيري" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>اسم المستخدم *</label>
                <input style={inp} placeholder="مثال: ahmed.mutairi" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>الدور الوظيفي</label>
                <select style={inp} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RoleKey }))}>
                  {Object.values(ROLES).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleAddUser} className="flex-1 gap-2 rounded-xl text-sm font-bold h-9"
                style={{ background: isDark ? "linear-gradient(135deg,#00f0ff,#818cf8)" : "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", border: "none" }}>
                <Save className="w-4 h-4" /> إضافة
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)} className="rounded-xl h-9 px-4" style={{ color: muted }}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
