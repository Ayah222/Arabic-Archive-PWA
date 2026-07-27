import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAllContracts, useGlobalCreateContract } from "../../controllers/useGlobal";
import { useProjects } from "../../controllers/useProjects";
import EmptyState from "../components/shared/EmptyState";
import { FileSignature, ExternalLink, Calendar, DollarSign, Plus, X } from "lucide-react";

const inputCls = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm";
const addBtnStyle = {
  background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)",
  color: "#fff",
  boxShadow: "0 0 20px rgba(0,240,255,0.30)",
};

const STATUS_LABEL: Record<string, string> = {
  active: "نشط", completed: "مكتمل", pending: "قيد الانتظار", cancelled: "ملغي"
};
const STATUS_COLOR: Record<string, string> = {
  active: "text-cyan-400 bg-cyan-400/10 border-cyan-400/25",
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/25",
};

function AddContractModal({ onClose }: { onClose: () => void }) {
  const { data: projects } = useProjects();
  const create = useGlobalCreateContract();
  const [form, setForm] = useState({
    projectId: "", title: "", party: "", value: "",
    startDate: "", endDate: "", status: "active", notes: "",
  });

  const handleSubmit = async () => {
    if (!form.projectId || !form.title.trim() || !form.party.trim() || !form.startDate || !form.endDate) return;
    await create.mutateAsync({
      projectId: form.projectId,
      data: {
        title: form.title, party: form.party,
        value: Number(form.value) || 0,
        startDate: form.startDate, endDate: form.endDate,
        status: form.status, notes: form.notes || null, fileUrl: null,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 relative max-h-[90vh] overflow-y-auto"
        style={{ background: "rgba(12,10,25,0.97)" }}>
        <button onClick={onClose} className="absolute left-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
        <h2 className="font-bold text-lg mb-4 text-center">إضافة عقد</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">المشروع *</label>
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputCls} dir="rtl">
              <option value="">اختر المشروع</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">عنوان العقد *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان العقد" className={inputCls} dir="rtl" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الطرف الآخر *</label>
            <input value={form.party} onChange={e => setForm(f => ({ ...f, party: e.target.value }))} placeholder="اسم الشركة أو المقاول" className={inputCls} dir="rtl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">قيمة العقد (ر.س)</label>
              <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الحالة</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls} dir="rtl">
                <option value="active">نشط</option>
                <option value="pending">قيد الانتظار</option>
                <option value="completed">مكتمل</option>
                <option value="cancelled">ملغي</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ البداية *</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ النهاية *</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} dir="rtl" />
          </div>
          <button onClick={handleSubmit}
            disabled={create.isPending || !form.projectId || !form.title.trim() || !form.party.trim() || !form.startDate || !form.endDate}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2 disabled:opacity-50"
            style={addBtnStyle}>
            {create.isPending ? "جاري الإضافة..." : "إضافة العقد"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AllContracts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useAllContracts(q || undefined);

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setShowAdd(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">العقود</h1>
          <p className="text-sm text-muted-foreground mt-1">جميع العقود عبر المشاريع</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={addBtnStyle}>
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث عن عقد..."
        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        dir="rtl" />

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl animate-pulse bg-muted" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon="📋" title="لا توجد عقود" description="أضف أول عقد بالضغط على الزر أعلاه" />
      ) : (
        <div className="space-y-3">
          {data.map(c => (
            <div key={c.id} className="liquid-glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.20) 0%, rgba(0,240,255,0.12) 100%)", border: "1px solid rgba(168,85,247,0.30)" }}>
                    <FileSignature className="w-5 h-5" style={{ color: "#a855f7" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground">{c.title}</h3>
                    <p className="text-sm text-muted-foreground">{c.party}</p>
                    <Link to={`/projects/${c.projectId}`} className="text-xs mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: "#00f0ff" }}>
                      <ExternalLink className="w-3 h-3" />{c.projectName}
                    </Link>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border shrink-0 ${STATUS_COLOR[c.status] ?? "text-muted-foreground bg-muted"}`}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{c.value.toLocaleString("ar-SA")} ر.س</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{c.startDate} — {c.endDate}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddContractModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
