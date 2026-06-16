import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  HardHat,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useContractors } from "../hooks/useContractors";
import { mockProjects } from "../data/mockData";
import {
  Contractor,
  ContractorStatus,
  ContractorSpecialty,
  CONTRACTOR_SPECIALTIES,
} from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ContractorStatus, string> = {
  active: "نشط",
  inactive: "غير نشط",
  suspended: "موقوف",
};

function statusStyle(
  status: ContractorStatus,
  isDark: boolean,
): React.CSSProperties {
  const map: Record<ContractorStatus, React.CSSProperties> = {
    active: {
      background: isDark ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.10)",
      color: isDark ? "#4ade80" : "#16a34a",
      border: `1px solid ${isDark ? "rgba(34,197,94,0.28)" : "rgba(34,197,94,0.30)"}`,
    },
    inactive: {
      background: isDark ? "rgba(148,163,184,0.10)" : "rgba(100,116,139,0.08)",
      color: isDark ? "#94a3b8" : "#475569",
      border: `1px solid ${isDark ? "rgba(148,163,184,0.22)" : "rgba(100,116,139,0.22)"}`,
    },
    suspended: {
      background: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
      color: isDark ? "#f87171" : "#dc2626",
      border: `1px solid ${isDark ? "rgba(239,68,68,0.28)" : "rgba(239,68,68,0.25)"}`,
    },
  };
  return map[status];
}

type FormData = Omit<
  Contractor,
  "id" | "number" | "createdAt" | "updatedAt" | "projectIds"
>;

const emptyForm = (): FormData => ({
  name: "",
  specialty: "civil",
  commercialRegistration: "",
  phone: "",
  email: "",
  bankAccount: "",
  notes: "",
  status: "active",
});

// ─── Dialog Component ─────────────────────────────────────────────────────────

interface DialogProps {
  isDark: boolean;
  title: string;
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onSave: () => void;
  onClose: () => void;
}

const ContractorDialog: React.FC<DialogProps> = ({
  isDark,
  title,
  form,
  setForm,
  onSave,
  onClose,
}) => {
  const glass: React.CSSProperties = isDark
    ? {
        background: "rgba(8,6,18,0.96)",
        border: "1px solid rgba(0,240,255,0.15)",
        boxShadow: "0 25px 80px rgba(0,0,0,0.80)",
      }
    : {
        background: "rgba(255,255,255,0.99)",
        border: "1px solid rgba(99,102,241,0.15)",
        boxShadow: "0 25px 80px rgba(99,102,241,0.14)",
      };

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "0.55rem 0.85rem",
    borderRadius: 10,
    outline: "none",
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    border: isDark
      ? "1px solid rgba(0,240,255,0.13)"
      : "1px solid rgba(99,102,241,0.18)",
    color: isDark ? "#e2e8f0" : "#1e293b",
    fontSize: 14,
  };

  const lbl: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
    color: isDark ? "rgba(0,240,255,0.65)" : "#4338ca",
    letterSpacing: "0.03em",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={glass}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            borderBottom: isDark
              ? "1px solid rgba(0,240,255,0.08)"
              : "1px solid rgba(99,102,241,0.10)",
          }}
        >
          <h2
            className="text-base font-bold"
            style={{ color: isDark ? "#fff" : "#1e1b4b" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#9ca3af" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label style={lbl}>اسم المقاول أو الشركة *</label>
              <input
                style={inp}
                value={form.name}
                placeholder="أدخل الاسم..."
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label style={lbl}>التخصص *</label>
              <select
                style={inp}
                value={form.specialty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    specialty: e.target.value as ContractorSpecialty,
                  }))
                }
              >
                {(
                  Object.entries(CONTRACTOR_SPECIALTIES) as [
                    ContractorSpecialty,
                    string,
                  ][]
                ).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>الحالة</label>
              <select
                style={inp}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as ContractorStatus,
                  }))
                }
              >
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
                <option value="suspended">موقوف</option>
              </select>
            </div>
            <div>
              <label style={lbl}>السجل التجاري</label>
              <input
                style={inp}
                value={form.commercialRegistration}
                placeholder="1010XXXXXX"
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    commercialRegistration: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label style={lbl}>رقم الجوال</label>
              <input
                style={inp}
                value={form.phone}
                placeholder="05XXXXXXXX"
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2">
              <label style={lbl}>البريد الإلكتروني</label>
              <input
                style={inp}
                type="email"
                value={form.email}
                placeholder="example@company.sa"
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2">
              <label style={lbl}>رقم الحساب البنكي (IBAN)</label>
              <input
                style={inp}
                value={form.bankAccount}
                placeholder="SA0380000000608010167519"
                onChange={(e) =>
                  setForm((f) => ({ ...f, bankAccount: e.target.value }))
                }
                dir="ltr"
              />
            </div>
            <div className="col-span-2">
              <label style={lbl}>ملاحظات</label>
              <textarea
                style={{ ...inp, resize: "none" }}
                rows={3}
                value={form.notes}
                placeholder="ملاحظات إضافية..."
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 justify-end px-6 py-4"
          style={{
            borderTop: isDark
              ? "1px solid rgba(0,240,255,0.08)"
              : "1px solid rgba(99,102,241,0.10)",
          }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              color: isDark ? "rgba(255,255,255,0.55)" : "#6b7280",
              background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
              border: isDark
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid #e2e8f0",
            }}
          >
            إلغاء
          </button>
          <button
            onClick={onSave}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2"
            style={{
              background: isDark
                ? "linear-gradient(135deg,#00f0ff,#7000ff)"
                : "linear-gradient(135deg,#6366f1,#a855f7)",
              boxShadow: isDark
                ? "0 0 22px rgba(0,240,255,0.30)"
                : "0 4px 16px rgba(99,102,241,0.35)",
            }}
          >
            <Save className="w-4 h-4" /> حفظ
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Dialog ────────────────────────────────────────────────────────────

const DeleteDialog: React.FC<{
  isDark: boolean;
  name: string;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ isDark, name, onConfirm, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
  >
    <div
      className="w-full max-w-sm rounded-2xl p-6 text-center"
      style={{
        background: isDark ? "rgba(8,6,18,0.96)" : "#fff",
        border: isDark
          ? "1px solid rgba(239,68,68,0.25)"
          : "1px solid rgba(239,68,68,0.20)",
        boxShadow: "0 25px 80px rgba(0,0,0,0.50)",
      }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{
          background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.25)",
        }}
      >
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h3
        className="text-base font-bold mb-2"
        style={{ color: isDark ? "#fff" : "#1e1b4b" }}
      >
        تأكيد الحذف
      </h3>
      <p
        className="text-sm mb-6"
        style={{ color: isDark ? "rgba(255,255,255,0.50)" : "#6b7280" }}
      >
        هل أنت متأكد من حذف المقاول{" "}
        <span
          className="font-bold"
          style={{ color: isDark ? "#f87171" : "#dc2626" }}
        >
          {name}
        </span>
        ؟
        <br />
        لن يتم حذف المستندات المرتبطة به.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl text-sm font-semibold"
          style={{
            color: isDark ? "rgba(255,255,255,0.55)" : "#6b7280",
            background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
            border: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid #e2e8f0",
          }}
        >
          إلغاء
        </button>
        <button
          onClick={onConfirm}
          className="px-5 py-2 rounded-xl text-sm font-bold text-white"
          style={{
            background: "linear-gradient(135deg,#ef4444,#dc2626)",
            boxShadow: "0 4px 14px rgba(239,68,68,0.35)",
          }}
        >
          حذف
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Contractors() {
  const { theme } = useAppContext();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const { contractors, addContractor, updateContractor, removeContractor } =
    useContractors();

  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialty] = useState<ContractorSpecialty | "all">(
    "all",
  );
  const [statusFilter, setStatus] = useState<ContractorStatus | "all">("all");
  const [sortOrder, setSort] = useState<"newest" | "oldest">("newest");
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Contractor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contractor | null>(null);
  const [addForm, setAddForm] = useState<FormData>(emptyForm());
  const [editForm, setEditForm] = useState<FormData>(emptyForm());

  // filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...contractors];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.number.toLowerCase().includes(q) ||
          CONTRACTOR_SPECIALTIES[c.specialty].includes(q) ||
          c.projectIds.some((pid) =>
            mockProjects
              .find((p) => p.id === pid)
              ?.name.toLowerCase()
              .includes(q),
          ),
      );
    }
    if (specialtyFilter !== "all")
      list = list.filter((c) => c.specialty === specialtyFilter);
    if (statusFilter !== "all")
      list = list.filter((c) => c.status === statusFilter);
    list.sort((a, b) => {
      const d =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortOrder === "newest" ? d : -d;
    });
    return list;
  }, [contractors, search, specialtyFilter, statusFilter, sortOrder]);

  // KPI counts
  const total = contractors.length;
  const active = contractors.filter((c) => c.status === "active").length;
  const inactive = contractors.filter((c) => c.status === "inactive").length;
  const suspended = contractors.filter((c) => c.status === "suspended").length;

  // handlers
  const handleAdd = () => {
    if (!addForm.name.trim()) return;
    const now = new Date().toISOString();
    addContractor({
      ...addForm,
      id: `cont_${Date.now()}`,
      number: `CONT-${contractors.length + 1}`,
      projectIds: [],
      createdAt: now,
      updatedAt: now,
    });
    setAddForm(emptyForm());
    setShowAdd(false);
  };

  const handleEdit = () => {
    if (!editTarget || !editForm.name.trim()) return;
    updateContractor({
      ...editTarget,
      ...editForm,
      updatedAt: new Date().toISOString(),
    });
    setEditTarget(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    removeContractor(deleteTarget.id);
    setDeleteTarget(null);
  };

  // shared styles
  const card: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.82)",
    backdropFilter: "blur(16px)",
    border: isDark
      ? "1px solid rgba(0,240,255,0.08)"
      : "1px solid rgba(99,102,241,0.12)",
    borderRadius: 16,
  };

  const inp: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.92)",
    border: isDark
      ? "1px solid rgba(0,240,255,0.12)"
      : "1px solid rgba(99,102,241,0.18)",
    borderRadius: 10,
    color: isDark ? "#e2e8f0" : "#1e293b",
    fontSize: 14,
    padding: "0.5rem 0.85rem",
    outline: "none",
  };

  const th = (label: string) => (
    <th
      key={label}
      className="px-4 py-3.5 text-right text-xs font-bold"
      style={{ color: isDark ? "rgba(0,240,255,0.65)" : "#4338ca" }}
    >
      {label}
    </th>
  );

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: isDark ? "#fff" : "#1e1b4b" }}
          >
            المقاولون
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: isDark ? "rgba(255,255,255,0.42)" : "#64748b" }}
          >
            إدارة وتتبع بيانات المقاولين المرتبطين بالمشاريع
          </p>
        </div>
        <button
          onClick={() => {
            setAddForm(emptyForm());
            setShowAdd(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{
            background: isDark
              ? "linear-gradient(135deg,#00f0ff,#7000ff)"
              : "linear-gradient(135deg,#6366f1,#a855f7)",
            boxShadow: isDark
              ? "0 0 24px rgba(0,240,255,0.28)"
              : "0 4px 16px rgba(99,102,241,0.35)",
          }}
        >
          <Plus className="w-4 h-4" /> إضافة مقاول
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "إجمالي المقاولين",
            value: total,
            color: isDark ? "#00f0ff" : "#6366f1",
          },
          { label: "نشط", value: active, color: "#4ade80" },
          {
            label: "غير نشط",
            value: inactive,
            color: isDark ? "#94a3b8" : "#64748b",
          },
          { label: "موقوف", value: suspended, color: "#f87171" },
        ].map((s, i) => (
          <div key={i} className="p-4 rounded-2xl" style={card}>
            <p
              className="text-xs font-medium mb-1.5"
              style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#64748b" }}
            >
              {s.label}
            </p>
            <p className="text-3xl font-bold" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div
        className="p-4 rounded-2xl flex flex-wrap gap-3 items-center"
        style={card}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: isDark ? "rgba(0,240,255,0.45)" : "#94a3b8" }}
          />
          <input
            className="w-full pr-9"
            style={inp}
            placeholder="بحث بالاسم أو الرقم أو التخصص..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          style={{ ...inp, minWidth: 160 }}
          value={specialtyFilter}
          onChange={(e) =>
            setSpecialty(e.target.value as ContractorSpecialty | "all")
          }
        >
          <option value="all">كل التخصصات</option>
          {(
            Object.entries(CONTRACTOR_SPECIALTIES) as [
              ContractorSpecialty,
              string,
            ][]
          ).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          style={{ ...inp, minWidth: 130 }}
          value={statusFilter}
          onChange={(e) =>
            setStatus(e.target.value as ContractorStatus | "all")
          }
        >
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="suspended">موقوف</option>
        </select>
        <select
          style={{ ...inp, minWidth: 140 }}
          value={sortOrder}
          onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
        >
          <option value="newest">الأحدث أولاً</option>
          <option value="oldest">الأقدم أولاً</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                style={{
                  background: isDark
                    ? "rgba(0,240,255,0.04)"
                    : "rgba(99,102,241,0.04)",
                  borderBottom: isDark
                    ? "2px solid rgba(0,240,255,0.10)"
                    : "2px solid rgba(99,102,241,0.12)",
                }}
              >
                {[
                  "رقم المقاول",
                  "الاسم",
                  "التخصص",
                  "الحالة",
                  "رقم الجوال",
                  "المشاريع",
                  "الإجراءات",
                ].map(th)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <HardHat
                      className="w-12 h-12 mx-auto mb-3 opacity-20"
                      style={{ color: isDark ? "#00f0ff" : "#6366f1" }}
                    />
                    <p
                      className="text-sm"
                      style={{
                        color: isDark ? "rgba(255,255,255,0.30)" : "#94a3b8",
                      }}
                    >
                      لا يوجد مقاولون مطابقون للبحث
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: isDark
                        ? "1px solid rgba(255,255,255,0.04)"
                        : "1px solid rgba(99,102,241,0.06)",
                      background:
                        idx % 2 !== 0
                          ? isDark
                            ? "rgba(255,255,255,0.012)"
                            : "rgba(99,102,241,0.012)"
                          : "transparent",
                    }}
                  >
                    <td className="px-4 py-3.5">
                      <span
                        className="text-sm font-mono font-bold"
                        style={{
                          color: isDark ? "rgba(0,240,255,0.70)" : "#4338ca",
                        }}
                      >
                        {c.number}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => navigate(`/contractors/${c.id}`)}
                        className="text-sm font-semibold hover:underline text-right"
                        style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="text-sm"
                        style={{
                          color: isDark ? "rgba(255,255,255,0.60)" : "#475569",
                        }}
                      >
                        {CONTRACTOR_SPECIALTIES[c.specialty]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={statusStyle(c.status, isDark)}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="text-sm"
                        style={{
                          color: isDark ? "rgba(255,255,255,0.60)" : "#475569",
                        }}
                      >
                        {c.phone || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="text-sm font-bold"
                        style={{ color: isDark ? "#fff" : "#1e293b" }}
                      >
                        {c.projectIds.length}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => navigate(`/contractors/${c.id}`)}
                          title="عرض"
                          className="p-1.5 rounded-lg"
                          style={{
                            color: isDark ? "rgba(0,240,255,0.65)" : "#6366f1",
                            background: isDark
                              ? "rgba(0,240,255,0.07)"
                              : "rgba(99,102,241,0.07)",
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditTarget(c);
                            setEditForm({
                              name: c.name,
                              specialty: c.specialty,
                              commercialRegistration: c.commercialRegistration,
                              phone: c.phone,
                              email: c.email,
                              notes: c.notes,
                              status: c.status,
                            });
                          }}
                          title="تعديل"
                          className="p-1.5 rounded-lg"
                          style={{
                            color: isDark ? "rgba(251,191,36,0.80)" : "#d97706",
                            background: isDark
                              ? "rgba(251,191,36,0.08)"
                              : "rgba(217,119,6,0.07)",
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          title="حذف"
                          className="p-1.5 rounded-lg"
                          style={{
                            color: isDark ? "#f87171" : "#ef4444",
                            background: isDark
                              ? "rgba(239,68,68,0.08)"
                              : "rgba(239,68,68,0.07)",
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Dialogs ── */}
      {showAdd && (
        <ContractorDialog
          isDark={isDark}
          title="إضافة مقاول جديد"
          form={addForm}
          setForm={setAddForm}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editTarget && (
        <ContractorDialog
          isDark={isDark}
          title="تعديل بيانات المقاول"
          form={editForm}
          setForm={setEditForm}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          isDark={isDark}
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
