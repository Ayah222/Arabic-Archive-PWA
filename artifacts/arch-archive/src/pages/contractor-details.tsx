import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  HardHat,
  ArrowRight,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  Edit2,
  Trash2,
  FolderOpen,
  FileText,
  ReceiptText,
  Building2,
  AlertTriangle,
  X,
  Save,
  CheckCircle,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useContractors } from "../hooks/useContractors";
import { mockProjects, mockDocuments } from "../data/mockData";
import {
  CONTRACTOR_SPECIALTIES,
  ContractorStatus,
  ContractorSpecialty,
  PROJECT_TYPES,
  Contractor,
} from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ContractorStatus, string> = {
  active: "نشط",
  inactive: "غير نشط",
  suspended: "موقوف",
};

function statusStyle(
  s: ContractorStatus,
  isDark: boolean,
): React.CSSProperties {
  const m: Record<ContractorStatus, React.CSSProperties> = {
    active: {
      background: isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.12)",
      color: isDark ? "#4ade80" : "#16a34a",
      border: "1px solid rgba(34,197,94,0.30)",
    },
    inactive: {
      background: isDark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.09)",
      color: isDark ? "#94a3b8" : "#475569",
      border: "1px solid rgba(148,163,184,0.25)",
    },
    suspended: {
      background: isDark ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.09)",
      color: isDark ? "#f87171" : "#dc2626",
      border: "1px solid rgba(239,68,68,0.28)",
    },
  };
  return m[s];
}

type FormData = Pick<
  Contractor,
  | "name"
  | "specialty"
  | "commercialRegistration"
  | "phone"
  | "email"
  | "bankAccount"
  | "notes"
  | "status"
>;

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

const EditDialog: React.FC<{
  isDark: boolean;
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onSave: () => void;
  onClose: () => void;
}> = ({ isDark, form, setForm, onSave, onClose }) => {
  const glass: React.CSSProperties = isDark
    ? {
        background: "rgba(8,6,18,0.96)",
        border: "1px solid rgba(0,240,255,0.15)",
        boxShadow: "0 25px 80px rgba(0,0,0,0.80)",
      }
    : {
        background: "#fff",
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
            تعديل بيانات المقاول
          </h2>
          <button onClick={onClose}>
            <X
              className="w-5 h-5"
              style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#9ca3af" }}
            />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label style={lbl}>اسم المقاول *</label>
              <input
                style={inp}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label style={lbl}>التخصص</label>
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
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
            <Save className="w-4 h-4" /> حفظ التعديلات
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
        border: "1px solid rgba(239,68,68,0.25)",
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
        حذف المقاول
      </h3>
      <p
        className="text-sm mb-6"
        style={{ color: isDark ? "rgba(255,255,255,0.50)" : "#6b7280" }}
      >
        هل أنت متأكد من حذف{" "}
        <span
          className="font-bold"
          style={{ color: isDark ? "#f87171" : "#dc2626" }}
        >
          {name}
        </span>
        ؟
        <br />
        سيتم إزالته من جميع المشاريع المرتبطة.
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
          حذف المقاول
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

interface Props {
  id?: string;
}

export default function ContractorDetails({ id }: Props) {
  const { theme } = useAppContext();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const { contractors, updateContractor, removeContractor } = useContractors();

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "projects" | "contracts" | "quotations"
  >("projects");
  const [editForm, setEditForm] = useState<FormData | null>(null);

  const contractor = useMemo(
    () => contractors.find((c) => c.id === id),
    [contractors, id],
  );

  const relatedProjects = useMemo(
    () =>
      contractor
        ? mockProjects.filter((p) => contractor.projectIds.includes(p.id))
        : [],
    [contractor],
  );

  const relatedContracts = useMemo(
    () =>
      contractor
        ? mockDocuments.filter(
            (d) => d.contractorId === contractor.id && d.type === "contract",
          )
        : [],
    [contractor],
  );

  const relatedQuotations = useMemo(
    () =>
      contractor
        ? mockDocuments.filter(
            (d) => d.contractorId === contractor.id && d.type === "quotation",
          )
        : [],
    [contractor],
  );

  const totalDocs = useMemo(
    () =>
      contractor
        ? mockDocuments.filter((d) => d.contractorId === contractor.id).length
        : 0,
    [contractor],
  );

  if (!contractor) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <HardHat
          className="w-16 h-16 mb-4 opacity-20"
          style={{ color: isDark ? "#00f0ff" : "#6366f1" }}
        />
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: isDark ? "#fff" : "#1e1b4b" }}
        >
          المقاول غير موجود
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#94a3b8" }}
        >
          لم يتم العثور على بيانات هذا المقاول
        </p>
        <button
          onClick={() => navigate("/contractors")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            color: isDark ? "#00f0ff" : "#6366f1",
            background: isDark
              ? "rgba(0,240,255,0.08)"
              : "rgba(99,102,241,0.08)",
          }}
        >
          <ArrowRight className="w-4 h-4" /> العودة للمقاولين
        </button>
      </div>
    );
  }

  const openEdit = () => {
    setEditForm({
      name: contractor.name,
      specialty: contractor.specialty,
      commercialRegistration: contractor.commercialRegistration,
      phone: contractor.phone,
      email: contractor.email,
      bankAccount: contractor.bankAccount,
      notes: contractor.notes,
      status: contractor.status,
    });
    setShowEdit(true);
  };

  const handleEdit = () => {
    if (!editForm || !editForm.name.trim()) return;
    updateContractor({
      ...contractor,
      ...editForm,
      updatedAt: new Date().toISOString(),
    });
    setShowEdit(false);
  };

  const handleDelete = () => {
    removeContractor(contractor.id);
    navigate("/contractors");
  };

  // Styles
  const card: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.82)",
    backdropFilter: "blur(16px)",
    border: isDark
      ? "1px solid rgba(0,240,255,0.08)"
      : "1px solid rgba(99,102,241,0.12)",
    borderRadius: 16,
  };

  const infoItem = (icon: React.ReactNode, label: string, value: string) => (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: isDark ? "rgba(0,240,255,0.08)" : "rgba(99,102,241,0.08)",
        }}
      >
        {icon}
      </div>
      <div>
        <p
          className="text-[11px] font-medium"
          style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#94a3b8" }}
        >
          {label}
        </p>
        <p
          className="text-sm font-semibold"
          style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );

  const tabs = [
    {
      key: "projects",
      label: "المشاريع",
      count: relatedProjects.length,
      icon: FolderOpen,
    },
    {
      key: "contracts",
      label: "العقود",
      count: relatedContracts.length,
      icon: FileText,
    },
    {
      key: "quotations",
      label: "عروض الأسعار",
      count: relatedQuotations.length,
      icon: ReceiptText,
    },
  ] as const;

  return (
    <div className="space-y-5">
      {/* ── Back ── */}
      <button
        onClick={() => navigate("/contractors")}
        className="flex items-center gap-2 text-sm font-semibold"
        style={{ color: isDark ? "rgba(0,240,255,0.70)" : "#6366f1" }}
      >
        <ArrowRight className="w-4 h-4" /> العودة لقائمة المقاولين
      </button>

      {/* ── Header Card ── */}
      <div className="p-6 rounded-2xl" style={card}>
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-bold"
            style={{
              background: isDark
                ? "linear-gradient(135deg,rgba(0,240,255,0.15),rgba(112,0,255,0.12))"
                : "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(168,85,247,0.12))",
              border: isDark
                ? "1px solid rgba(0,240,255,0.20)"
                : "1px solid rgba(99,102,241,0.22)",
              color: isDark ? "#00f0ff" : "#6366f1",
            }}
          >
            {contractor.name.charAt(0)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-3 mb-1">
              <h1
                className="text-xl font-bold"
                style={{ color: isDark ? "#fff" : "#1e1b4b" }}
              >
                {contractor.name}
              </h1>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={statusStyle(contractor.status, isDark)}
              >
                {STATUS_LABELS[contractor.status]}
              </span>
            </div>
            <p
              className="text-sm mb-1"
              style={{ color: isDark ? "rgba(0,240,255,0.65)" : "#6366f1" }}
            >
              {CONTRACTOR_SPECIALTIES[contractor.specialty]}
            </p>
            <p
              className="text-xs font-mono"
              style={{ color: isDark ? "rgba(255,255,255,0.35)" : "#94a3b8" }}
            >
              {contractor.number}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={openEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                color: isDark ? "rgba(251,191,36,0.85)" : "#d97706",
                background: isDark
                  ? "rgba(251,191,36,0.09)"
                  : "rgba(217,119,6,0.08)",
                border: isDark
                  ? "1px solid rgba(251,191,36,0.18)"
                  : "1px solid rgba(217,119,6,0.18)",
              }}
            >
              <Edit2 className="w-4 h-4" /> تعديل
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                color: isDark ? "#f87171" : "#ef4444",
                background: isDark
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(239,68,68,0.07)",
                border: isDark
                  ? "1px solid rgba(239,68,68,0.18)"
                  : "1px solid rgba(239,68,68,0.18)",
              }}
            >
              <Trash2 className="w-4 h-4" /> حذف
            </button>
          </div>
        </div>

        {/* Details Grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 pt-5"
          style={{
            borderTop: isDark
              ? "1px solid rgba(255,255,255,0.06)"
              : "1px solid rgba(99,102,241,0.08)",
          }}
        >
          {infoItem(
            <Phone
              className="w-4 h-4"
              style={{ color: isDark ? "rgba(0,240,255,0.65)" : "#6366f1" }}
            />,
            "رقم الجوال",
            contractor.phone,
          )}
          {infoItem(
            <Mail
              className="w-4 h-4"
              style={{ color: isDark ? "rgba(0,240,255,0.65)" : "#6366f1" }}
            />,
            "البريد الإلكتروني",
            contractor.email,
          )}
          {infoItem(
            <CreditCard
              className="w-4 h-4"
              style={{ color: isDark ? "rgba(0,240,255,0.65)" : "#6366f1" }}
            />,
            "السجل التجاري",
            contractor.commercialRegistration,
          )}
          {infoItem(
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: isDark ? "rgba(0,240,255,0.65)" : "#6366f1" }}
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>,
            "رقم الحساب البنكي (IBAN)",
            contractor.bankAccount,
          )}
          {infoItem(
            <Calendar
              className="w-4 h-4"
              style={{ color: isDark ? "rgba(0,240,255,0.65)" : "#6366f1" }}
            />,
            "تاريخ الإضافة",
            new Date(contractor.createdAt).toLocaleDateString("ar-SA"),
          )}
          {infoItem(
            <Calendar
              className="w-4 h-4"
              style={{ color: isDark ? "rgba(0,240,255,0.65)" : "#6366f1" }}
            />,
            "آخر تحديث",
            new Date(contractor.updatedAt).toLocaleDateString("ar-SA"),
          )}
          {contractor.notes &&
            infoItem(
              <Building2
                className="w-4 h-4"
                style={{ color: isDark ? "rgba(0,240,255,0.65)" : "#6366f1" }}
              />,
              "ملاحظات",
              contractor.notes,
            )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "المشاريع",
            value: relatedProjects.length,
            icon: FolderOpen,
            color: isDark ? "#00f0ff" : "#6366f1",
          },
          {
            label: "العقود",
            value: relatedContracts.length,
            icon: FileText,
            color: "#4ade80",
          },
          {
            label: "عروض الأسعار",
            value: relatedQuotations.length,
            icon: ReceiptText,
            color: "#fb923c",
          },
          {
            label: "إجمالي المستندات",
            value: totalDocs,
            icon: Building2,
            color: isDark ? "#a78bfa" : "#8b5cf6",
          },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="p-4 rounded-2xl" style={card}>
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-xs font-medium"
                  style={{
                    color: isDark ? "rgba(255,255,255,0.42)" : "#64748b",
                  }}
                >
                  {k.label}
                </p>
                <Icon
                  className="w-4 h-4"
                  style={{ color: k.color, opacity: 0.7 }}
                />
              </div>
              <p className="text-3xl font-bold" style={{ color: k.color }}>
                {k.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Tabs ── */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        {/* Tab buttons */}
        <div
          className="flex border-b"
          style={{
            borderColor: isDark
              ? "rgba(0,240,255,0.08)"
              : "rgba(99,102,241,0.10)",
          }}
        >
          {tabs.map((t) => {
            const active = activeTab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="flex items-center gap-2 px-5 py-3.5 text-sm font-semibold relative transition-colors"
                style={{
                  color: active
                    ? isDark
                      ? "#00f0ff"
                      : "#6366f1"
                    : isDark
                      ? "rgba(255,255,255,0.40)"
                      : "#94a3b8",
                  borderBottom: active
                    ? `2px solid ${isDark ? "#00f0ff" : "#6366f1"}`
                    : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    background: active
                      ? isDark
                        ? "rgba(0,240,255,0.15)"
                        : "rgba(99,102,241,0.12)"
                      : isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.05)",
                    color: active
                      ? isDark
                        ? "#00f0ff"
                        : "#6366f1"
                      : isDark
                        ? "rgba(255,255,255,0.40)"
                        : "#94a3b8",
                  }}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-0">
          {/* Projects */}
          {activeTab === "projects" &&
            (relatedProjects.length === 0 ? (
              <div className="py-12 text-center">
                <FolderOpen
                  className="w-10 h-10 mx-auto mb-3 opacity-20"
                  style={{ color: isDark ? "#00f0ff" : "#6366f1" }}
                />
                <p
                  className="text-sm"
                  style={{
                    color: isDark ? "rgba(255,255,255,0.30)" : "#94a3b8",
                  }}
                >
                  لا توجد مشاريع مرتبطة بهذا المقاول
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        background: isDark
                          ? "rgba(0,240,255,0.03)"
                          : "rgba(99,102,241,0.03)",
                        borderBottom: isDark
                          ? "1px solid rgba(0,240,255,0.08)"
                          : "1px solid rgba(99,102,241,0.10)",
                      }}
                    >
                      {[
                        "رقم المشروع",
                        "اسم المشروع",
                        "العميل",
                        "المدينة",
                        "النوع",
                        "الحالة",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-right text-xs font-bold"
                          style={{
                            color: isDark ? "rgba(0,240,255,0.60)" : "#4338ca",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {relatedProjects.map((p, idx) => (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: isDark
                            ? "1px solid rgba(255,255,255,0.04)"
                            : "1px solid rgba(99,102,241,0.06)",
                          background:
                            idx % 2 !== 0
                              ? isDark
                                ? "rgba(255,255,255,0.01)"
                                : "rgba(99,102,241,0.01)"
                              : "transparent",
                        }}
                      >
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-mono font-bold"
                            style={{
                              color: isDark
                                ? "rgba(0,240,255,0.65)"
                                : "#4338ca",
                            }}
                          >
                            {p.number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/projects/${p.id}`)}
                            className="text-sm font-semibold hover:underline text-right"
                            style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
                          >
                            {p.name}
                          </button>
                        </td>
                        <td
                          className="px-4 py-3 text-sm"
                          style={{
                            color: isDark
                              ? "rgba(255,255,255,0.55)"
                              : "#475569",
                          }}
                        >
                          {p.client}
                        </td>
                        <td
                          className="px-4 py-3 text-sm"
                          style={{
                            color: isDark
                              ? "rgba(255,255,255,0.55)"
                              : "#475569",
                          }}
                        >
                          {p.city}
                        </td>
                        <td
                          className="px-4 py-3 text-sm"
                          style={{
                            color: isDark
                              ? "rgba(255,255,255,0.55)"
                              : "#475569",
                          }}
                        >
                          {PROJECT_TYPES[p.projectType]}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={
                              p.status === "active"
                                ? {
                                    background: isDark
                                      ? "rgba(34,197,94,0.12)"
                                      : "rgba(34,197,94,0.10)",
                                    color: isDark ? "#4ade80" : "#16a34a",
                                    border: "1px solid rgba(34,197,94,0.28)",
                                  }
                                : {
                                    background: isDark
                                      ? "rgba(148,163,184,0.10)"
                                      : "rgba(100,116,139,0.08)",
                                    color: isDark ? "#94a3b8" : "#475569",
                                    border: "1px solid rgba(148,163,184,0.22)",
                                  }
                            }
                          >
                            {p.status === "active" ? "نشط" : "مكتمل"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {/* Contracts */}
          {activeTab === "contracts" &&
            (relatedContracts.length === 0 ? (
              <div className="py-12 text-center">
                <FileText
                  className="w-10 h-10 mx-auto mb-3 opacity-20"
                  style={{ color: isDark ? "#00f0ff" : "#6366f1" }}
                />
                <p
                  className="text-sm"
                  style={{
                    color: isDark ? "rgba(255,255,255,0.30)" : "#94a3b8",
                  }}
                >
                  لا توجد عقود مرتبطة بهذا المقاول
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        background: isDark
                          ? "rgba(0,240,255,0.03)"
                          : "rgba(99,102,241,0.03)",
                        borderBottom: isDark
                          ? "1px solid rgba(0,240,255,0.08)"
                          : "1px solid rgba(99,102,241,0.10)",
                      }}
                    >
                      {[
                        "رقم العقد",
                        "اسم المستند",
                        "اسم المشروع",
                        "تاريخ الرفع",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-right text-xs font-bold"
                          style={{
                            color: isDark ? "rgba(0,240,255,0.60)" : "#4338ca",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {relatedContracts.map((d, idx) => {
                      const project = mockProjects.find(
                        (p) => p.id === d.projectId,
                      );
                      return (
                        <tr
                          key={d.id}
                          style={{
                            borderBottom: isDark
                              ? "1px solid rgba(255,255,255,0.04)"
                              : "1px solid rgba(99,102,241,0.06)",
                            background:
                              idx % 2 !== 0
                                ? isDark
                                  ? "rgba(255,255,255,0.01)"
                                  : "rgba(99,102,241,0.01)"
                                : "transparent",
                          }}
                        >
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-mono font-bold"
                              style={{
                                color: isDark
                                  ? "rgba(0,240,255,0.65)"
                                  : "#4338ca",
                              }}
                            >
                              {d.number}
                            </span>
                          </td>
                          <td
                            className="px-4 py-3 text-sm"
                            style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
                          >
                            {d.name}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() =>
                                project && navigate(`/projects/${project.id}`)
                              }
                              className="text-sm hover:underline"
                              style={{
                                color: isDark
                                  ? "rgba(255,255,255,0.55)"
                                  : "#475569",
                              }}
                            >
                              {project?.name || "—"}
                            </button>
                          </td>
                          <td
                            className="px-4 py-3 text-sm"
                            style={{
                              color: isDark
                                ? "rgba(255,255,255,0.55)"
                                : "#475569",
                            }}
                          >
                            {new Date(d.createdAt).toLocaleDateString("ar-SA")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

          {/* Quotations */}
          {activeTab === "quotations" &&
            (relatedQuotations.length === 0 ? (
              <div className="py-12 text-center">
                <ReceiptText
                  className="w-10 h-10 mx-auto mb-3 opacity-20"
                  style={{ color: isDark ? "#00f0ff" : "#6366f1" }}
                />
                <p
                  className="text-sm"
                  style={{
                    color: isDark ? "rgba(255,255,255,0.30)" : "#94a3b8",
                  }}
                >
                  لا توجد عروض أسعار مرتبطة بهذا المقاول
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        background: isDark
                          ? "rgba(0,240,255,0.03)"
                          : "rgba(99,102,241,0.03)",
                        borderBottom: isDark
                          ? "1px solid rgba(0,240,255,0.08)"
                          : "1px solid rgba(99,102,241,0.10)",
                      }}
                    >
                      {[
                        "رقم العرض",
                        "اسم المستند",
                        "اسم المشروع",
                        "تاريخ الرفع",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-right text-xs font-bold"
                          style={{
                            color: isDark ? "rgba(0,240,255,0.60)" : "#4338ca",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {relatedQuotations.map((d, idx) => {
                      const project = mockProjects.find(
                        (p) => p.id === d.projectId,
                      );
                      return (
                        <tr
                          key={d.id}
                          style={{
                            borderBottom: isDark
                              ? "1px solid rgba(255,255,255,0.04)"
                              : "1px solid rgba(99,102,241,0.06)",
                            background:
                              idx % 2 !== 0
                                ? isDark
                                  ? "rgba(255,255,255,0.01)"
                                  : "rgba(99,102,241,0.01)"
                                : "transparent",
                          }}
                        >
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-mono font-bold"
                              style={{
                                color: isDark
                                  ? "rgba(0,240,255,0.65)"
                                  : "#4338ca",
                              }}
                            >
                              {d.number}
                            </span>
                          </td>
                          <td
                            className="px-4 py-3 text-sm"
                            style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
                          >
                            {d.name}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() =>
                                project && navigate(`/projects/${project.id}`)
                              }
                              className="text-sm hover:underline"
                              style={{
                                color: isDark
                                  ? "rgba(255,255,255,0.55)"
                                  : "#475569",
                              }}
                            >
                              {project?.name || "—"}
                            </button>
                          </td>
                          <td
                            className="px-4 py-3 text-sm"
                            style={{
                              color: isDark
                                ? "rgba(255,255,255,0.55)"
                                : "#475569",
                            }}
                          >
                            {new Date(d.createdAt).toLocaleDateString("ar-SA")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </div>

      {/* ── Dialogs ── */}
      {showEdit && editForm && (
        <EditDialog
          isDark={isDark}
          form={editForm}
          setForm={setEditForm as any}
          onSave={handleEdit}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showDelete && (
        <DeleteDialog
          isDark={isDark}
          name={contractor.name}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
