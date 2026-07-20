import { useState } from "react";
import { useFinance, useFinanceActions, type FinanceInput } from "../../controllers/useGlobal";
import Modal from "../components/shared/Modal";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import Toast from "../components/shared/Toast";
import EmptyState from "../components/shared/EmptyState";
import { TrendingUp, TrendingDown, Wallet, Bell, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";

const CATEGORIES = ["دفعات المشاريع", "رواتب", "رسوم حكومية", "مواد ومستلزمات", "ضرائب", "مصاريف إدارية", "أخرى"];

const empty: FinanceInput = {
  title: "", amount: 0, type: "income", category: CATEGORIES[0],
  date: new Date().toISOString().split("T")[0],
  reminderDate: null, notes: null, projectId: null,
};

function NeonStat({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="liquid-glass-card rounded-2xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}20`, border: `1px solid ${color}40`, boxShadow: `0 0 20px ${color}15` }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold" style={{ color }}>{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground opacity-70">{sub}</p>}
      </div>
    </div>
  );
}

export default function FinancialArchive() {
  const { data, isLoading } = useFinance();
  const { create, update, remove } = useFinanceActions();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<{ id: string; data: FinanceInput } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FinanceInput>(empty);
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const totalIncome = data?.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalExpense = data?.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0) ?? 0;
  const balance = totalIncome - totalExpense;

  const upcoming = data?.filter(r => {
    if (!r.reminderDate) return false;
    const d = new Date(r.reminderDate);
    const now = new Date();
    return d >= now && d <= new Date(now.getTime() + 30 * 86400000);
  }) ?? [];

  const filtered = data?.filter(r => filterType === "all" || r.type === filterType) ?? [];

  const fmt = (n: number) => n.toLocaleString("ar-SA") + " ر.س";

  const handleCreate = async () => {
    if (!form.title || !form.amount || !form.date) return;
    try {
      await create.mutateAsync(form);
      setShowAdd(false); setForm(empty);
      setToast({ message: "تم إضافة السجل المالي", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    try {
      await update.mutateAsync({ id: editItem.id, data: editItem.data });
      setEditItem(null);
      setToast({ message: "تم تحديث السجل", type: "success" });
    } catch { setToast({ message: "فشل في التحديث", type: "error" }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove.mutateAsync(deleteId);
      setDeleteId(null);
      setToast({ message: "تم حذف السجل", type: "success" });
    } catch { setToast({ message: "فشل في الحذف", type: "error" }); }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الأرشيف المالي</h1>
          <p className="text-sm text-muted-foreground mt-1">سجل الإيرادات والمصروفات والتذكيرات المالية</p>
        </div>
        <button onClick={() => { setForm(empty); setShowAdd(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)", color: "#fff",
            boxShadow: "0 0 20px rgba(0,240,255,0.30)" }}>
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NeonStat label="إجمالي الإيرادات" value={fmt(totalIncome)} icon={TrendingUp} color="#00f0ff" />
        <NeonStat label="إجمالي المصروفات" value={fmt(totalExpense)} icon={TrendingDown} color="#ff0080" />
        <NeonStat label="الرصيد الصافي" value={fmt(balance)} icon={Wallet} color={balance >= 0 ? "#00ff88" : "#ff4444"}
          sub={balance >= 0 ? "فائض" : "عجز"} />
      </div>

      {/* Upcoming Reminders */}
      {upcoming.length > 0 && (
        <div className="liquid-glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" style={{ color: "#f0a500" }} />
            <h3 className="font-bold text-foreground">تذكيرات خلال 30 يوماً ({upcoming.length})</h3>
          </div>
          <div className="space-y-2">
            {upcoming.map(r => (
              <div key={r.id} className="flex items-center gap-3 text-sm"
                style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.20)" }}>
                <Bell className="w-4 h-4 shrink-0" style={{ color: "#f0a500" }} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{r.title}</span>
                  <span className="text-muted-foreground mr-2 text-xs">— {r.reminderDate}</span>
                </div>
                <span className="font-bold shrink-0" style={{ color: r.type === "income" ? "#00f0ff" : "#ff0080" }}>
                  {r.type === "income" ? "+" : "-"}{fmt(r.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["all", "income", "expense"] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={filterType === t
              ? { background: "rgba(0,240,255,0.10)", border: "1px solid rgba(0,240,255,0.50)", color: "#00f0ff" }
              : { background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.45)" }}>
            {t === "all" ? "الكل" : t === "income" ? "الإيرادات" : "المصروفات"}
          </button>
        ))}
      </div>

      {/* Records List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse bg-muted" />)}</div>
      ) : !filtered.length ? (
        <EmptyState icon="💰" title="لا توجد سجلات" description="أضف أول سجل مالي" />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const isIncome = r.type === "income";
            const color = isIncome ? "#00f0ff" : "#ff0080";
            return (
              <div key={r.id} className="liquid-glass-card rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                    {isIncome ? <TrendingUp className="w-5 h-5" style={{ color }} /> : <TrendingDown className="w-5 h-5" style={{ color }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground truncate">{r.title}</h4>
                    <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{r.date}</span>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>{r.category}</span>
                      {r.reminderDate && (
                        <span className="flex items-center gap-1" style={{ color: "#f0a500" }}>
                          <Bell className="w-3 h-3" />تذكير {r.reminderDate}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base font-black" style={{ color }}>
                      {isIncome ? "+" : "-"}{r.amount.toLocaleString("ar-SA")}
                    </span>
                    <button onClick={() => setEditItem({ id: r.id, data: { title: r.title, amount: r.amount, type: r.type, category: r.category, date: r.date, reminderDate: r.reminderDate, notes: r.notes, projectId: r.projectId } })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => setDeleteId(r.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(239,68,68,0.08)" }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
                {r.notes && <p className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">{r.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showAdd || !!editItem} onClose={() => { setShowAdd(false); setEditItem(null); }}
        title={editItem ? "تعديل السجل المالي" : "إضافة سجل مالي"} size="lg">
        <FinanceForm
          data={editItem?.data ?? form}
          onChange={editItem ? (d) => setEditItem(e => e ? { ...e, data: d } : null) : setForm}
          onSubmit={editItem ? handleUpdate : handleCreate}
          loading={create.isPending || update.isPending}
          submitLabel={editItem ? "حفظ التعديلات" : "إضافة السجل"}
        />
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="حذف السجل المالي" message="هل أنت متأكد من حذف هذا السجل المالي؟"
        confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

function FinanceForm({ data, onChange, onSubmit, loading, submitLabel }: {
  data: FinanceInput; onChange: (d: FinanceInput) => void;
  onSubmit: () => void; loading: boolean; submitLabel: string;
}) {
  const set = <K extends keyof FinanceInput>(k: K, v: FinanceInput[K]) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => set("type", "income")}
          className="py-3 rounded-xl text-sm font-bold transition-all"
          style={data.type === "income"
            ? { background: "rgba(0,240,255,0.12)", border: "1px solid rgba(0,240,255,0.50)", color: "#00f0ff" }
            : { background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)" }}>
          إيراد +
        </button>
        <button onClick={() => set("type", "expense")}
          className="py-3 rounded-xl text-sm font-bold transition-all"
          style={data.type === "expense"
            ? { background: "rgba(255,0,128,0.12)", border: "1px solid rgba(255,0,128,0.50)", color: "#ff0080" }
            : { background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)" }}>
          مصروف −
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">العنوان *</label>
        <input value={data.title} onChange={e => set("title", e.target.value)} placeholder="مثال: دفعة مشروع برج الأعمال"
          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" dir="rtl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">المبلغ (ر.س) *</label>
          <input type="number" value={data.amount || ""} onChange={e => set("amount", Number(e.target.value))} placeholder="0"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" dir="rtl" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">الفئة</label>
          <select value={data.category} onChange={e => set("category", e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" dir="rtl">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">التاريخ *</label>
          <input type="date" value={data.date} onChange={e => set("date", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">تذكير بتاريخ</label>
          <input type="date" value={data.reminderDate ?? ""} onChange={e => set("reminderDate", e.target.value || null)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">ملاحظات</label>
        <textarea value={data.notes ?? ""} onChange={e => set("notes", e.target.value || null)} rows={2}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none" dir="rtl" />
      </div>
      <button onClick={onSubmit} disabled={loading || !data.title || !data.amount}
        className="w-full py-3.5 rounded-xl font-bold transition-all disabled:opacity-50"
        style={{ background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)", color: "#fff",
          boxShadow: "0 0 20px rgba(0,240,255,0.30)" }}>
        {loading ? "جاري الحفظ..." : submitLabel}
      </button>
    </div>
  );
}
