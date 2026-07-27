import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAllLetters, useGlobalCreateLetter } from "../../controllers/useGlobal";
import { useProjects } from "../../controllers/useProjects";
import EmptyState from "../components/shared/EmptyState";
import { Mail, ArrowUpRight, ArrowDownLeft, ExternalLink, Plus, X } from "lucide-react";

const inputCls = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm";
const btnPrimary = "w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 mt-2";

function AddLetterModal({ onClose }: { onClose: () => void }) {
  const { data: projects } = useProjects();
  const create = useGlobalCreateLetter();
  const [form, setForm] = useState({ projectId: "", subject: "", direction: "outgoing", from: "", to: "", date: "", reference: "", notes: "" });

  const handleSubmit = async () => {
    if (!form.projectId || !form.subject.trim() || !form.from.trim() || !form.to.trim() || !form.date) return;
    await create.mutateAsync({
      projectId: form.projectId,
      data: { subject: form.subject, direction: form.direction, from: form.from, to: form.to, date: form.date, reference: form.reference || null, notes: form.notes || null, fileUrl: null },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 relative max-h-[90vh] overflow-y-auto" style={{ background: "rgba(12,10,25,0.97)" }}>
        <button onClick={onClose} className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        <h2 className="font-bold text-lg mb-4 text-center">إضافة خطاب</h2>
        <div className="space-y-3">
          <div><label className="block text-sm font-medium mb-1">المشروع *</label>
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputCls} dir="rtl">
              <option value="">اختر المشروع</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium mb-1">الموضوع *</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="موضوع الخطاب" className={inputCls} dir="rtl" />
          </div>
          <div><label className="block text-sm font-medium mb-1">الاتجاه</label>
            <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} className={inputCls} dir="rtl">
              <option value="outgoing">⬆️ صادر</option>
              <option value="incoming">⬇️ وارد</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">من *</label>
              <input value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} placeholder="المرسل" className={inputCls} dir="rtl" />
            </div>
            <div><label className="block text-sm font-medium mb-1">إلى *</label>
              <input value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} placeholder="المستلم" className={inputCls} dir="rtl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">التاريخ *</label>
              <input type="date" dir="ltr" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
            </div>
            <div><label className="block text-sm font-medium mb-1">رقم المرجع</label>
              <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="SA-001" className={inputCls} dir="ltr" />
            </div>
          </div>
          <div><label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} dir="rtl" />
          </div>
          <p className="text-xs text-muted-foreground">سيتم توليد رقم مرجعي تلقائي عند الحفظ</p>
          <button onClick={handleSubmit} disabled={create.isPending || !form.projectId || !form.subject.trim() || !form.from.trim() || !form.to.trim() || !form.date} className={btnPrimary}>
            {create.isPending ? "جاري الإضافة..." : "إضافة الخطاب"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AllLetters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useAllLetters(q || undefined);

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
          <h1 className="text-2xl font-bold text-foreground">الخطابات والمراسلات</h1>
          <p className="text-sm text-muted-foreground mt-1">جميع الخطابات الصادرة والواردة</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)", color: "#fff", boxShadow: "0 0 20px rgba(0,240,255,0.30)" }}>
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث عن خطاب..."
        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        dir="rtl" />

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse bg-muted" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon="✉️" title="لا توجد خطابات" description="أضف أول خطاب بالضغط على الزر أعلاه" />
      ) : (
        <div className="space-y-3">
          {data.map(l => {
            const isOut = l.direction === "outgoing";
            return (
              <div key={l.id} className="liquid-glass-card rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isOut
                        ? "linear-gradient(135deg, rgba(255,0,128,0.16) 0%, rgba(112,0,255,0.10) 100%)"
                        : "linear-gradient(135deg, rgba(0,240,255,0.16) 0%, rgba(112,0,255,0.10) 100%)",
                      border: `1px solid ${isOut ? "rgba(255,0,128,0.25)" : "rgba(0,240,255,0.22)"}`,
                    }}>
                    {isOut
                      ? <ArrowUpRight className="w-5 h-5" style={{ color: "#ff0080" }} />
                      : <ArrowDownLeft className="w-5 h-5" style={{ color: "#00f0ff" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground truncate">{l.subject}</h3>
                      {l.autoRef && <span className="text-xs font-mono text-muted-foreground shrink-0">{l.autoRef}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">من: {l.from} ← {l.to}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-muted-foreground" style={{ color: isOut ? "#ff0080" : "#00f0ff" }}>{l.date}</span>
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                        l.distributionStatus === "received" ? "bg-green-500/15 text-green-400" :
                        l.distributionStatus === "sent" ? "bg-blue-500/15 text-blue-400" :
                        "bg-gray-500/15 text-gray-400"
                      }`}>
                        {l.distributionStatus === "received" ? "تم الاستلام" : l.distributionStatus === "sent" ? "تم الإرسال" : "لم يُرسل"}
                      </span>
                    </div>
                    <Link to={`/projects/${l.projectId}`} className="text-xs mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: isOut ? "#ff0080" : "#00f0ff" }}>
                      <ExternalLink className="w-3 h-3" />{l.projectName}
                    </Link>
                  </div>
                </div>
                {l.notes && <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2 italic">{l.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
      {showAdd && <AddLetterModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
