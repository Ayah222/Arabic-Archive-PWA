import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, X, UserSearch, Sparkles, Trash2, Phone, Mail } from "lucide-react";
import {
  useCandidates, useCreateCandidate, useUpdateCandidate, useDeleteCandidate, useExtractCvSkills,
  type HRCandidate,
} from "../../../controllers/useHr";
import FileUpload from "../../components/shared/FileUpload";
import EmptyState from "../../components/shared/EmptyState";
import { getArchivePermissions } from "../../../controllers/permissions";

const inputCls = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm";
const addBtnStyle = { background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)", color: "#fff" };

const STATUS_LABEL: Record<string, string> = {
  applied: "قدّم للتو", screening: "قيد الفرز", interview: "مقابلة", offered: "عرض عمل", hired: "تم التوظيف", rejected: "مرفوض",
};
const OFFER_LABEL: Record<string, string> = { none: "—", pending: "قيد الإعداد", sent: "تم الإرسال", accepted: "مقبول", declined: "مرفوض" };

function AddCandidateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateCandidate();
  const extract = useExtractCvSkills();
  const [form, setForm] = useState({ name: "", phone: "", email: "", positionApplied: "" });
  const [cv, setCv] = useState<{ url: string; filename: string } | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);

  const handleCvUpload = async (result: { url: string; filename: string }) => {
    setCv(result);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const candidate = await create.mutateAsync({
      name: form.name.trim(), phone: form.phone || null, email: form.email || null,
      positionApplied: form.positionApplied || null, cvUrl: cv?.url || null, skills, status: "applied", offerStatus: "none",
    });
    if (cv?.url) {
      setExtracting(true);
      try {
        const res = await extract.mutateAsync({ id: (candidate as unknown as HRCandidate).id, cvUrl: cv.url });
        if (res.extracted) setSkills(res.skills);
      } catch { /* keep manual entry */ }
      setExtracting(false);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 relative max-h-[90vh] overflow-y-auto" style={{ background: "rgba(12,10,25,0.97)" }}>
        <button onClick={onClose} className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        <h2 className="font-bold text-lg mb-4 text-center">إضافة مرشح</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">الاسم *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الوظيفة المتقدم لها</label>
            <input value={form.positionApplied} onChange={e => setForm(f => ({ ...f, positionApplied: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">الهاتف</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">السيرة الذاتية (PDF يفضل)</label>
            <FileUpload onUpload={handleCvUpload} accept=".pdf,.doc,.docx" projectId="hr" section="hr-candidates" label={cv ? cv.filename : "رفع السيرة الذاتية"} />
          </div>
          <button onClick={handleSubmit} disabled={create.isPending || extracting || !form.name.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2 disabled:opacity-50" style={addBtnStyle}>
            {extracting ? "جاري استخراج المهارات..." : create.isPending ? "جاري الإضافة..." : "إضافة المرشح"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateCard({ c }: { c: HRCandidate }) {
  const { canEdit } = getArchivePermissions();
  const update = useUpdateCandidate();
  const del = useDeleteCandidate();
  const extract = useExtractCvSkills();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="liquid-glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 cursor-pointer" onClick={() => setExpanded(x => !x)}>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
            <UserSearch className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.positionApplied || "—"}</p>
            {c.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {c.skills.slice(0, expanded ? undefined : 5).map(s => (
                  <span key={s} className="px-2 py-0.5 rounded-md text-[11px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {canEdit && <button onClick={() => del.mutate(c.id)} className="text-red-400 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {c.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3" />{c.phone}</span>}
            {c.email && <span className="flex items-center gap-1" dir="ltr"><Mail className="w-3 h-3" />{c.email}</span>}
            {c.cvUrl && <a href={c.cvUrl} target="_blank" rel="noreferrer" className="underline">عرض السيرة الذاتية</a>}
          </div>
          {canEdit && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">حالة المرشح</label>
                  <select value={c.status} onChange={e => update.mutate({ id: c.id, status: e.target.value })} className={inputCls}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">حالة العرض</label>
                  <select value={c.offerStatus} onChange={e => update.mutate({ id: c.id, offerStatus: e.target.value })} className={inputCls}>
                    {Object.entries(OFFER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              {c.offerStatus !== "none" && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="الراتب المعروض" defaultValue={c.offerSalary ?? ""} onBlur={e => update.mutate({ id: c.id, offerSalary: Number(e.target.value) || null })} className={inputCls} />
                  <input type="date" dir="ltr" defaultValue={c.offerStartDate ?? ""} onBlur={e => update.mutate({ id: c.id, offerStartDate: e.target.value || null })} className={inputCls} />
                </div>
              )}
              {c.cvUrl && (
                <button onClick={() => extract.mutate({ id: c.id, cvUrl: c.cvUrl! })} disabled={extract.isPending}
                  className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                  <Sparkles className="w-3.5 h-3.5" /> {extract.isPending ? "جاري الاستخراج..." : "إعادة استخراج المهارات من السيرة الذاتية"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function HRCandidates() {
  const { canEdit } = getArchivePermissions();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useCandidates();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> الموارد البشرية
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">التوظيف والمرشحون</h1>
          <p className="text-sm text-muted-foreground mt-1">رفع السير الذاتية واستخراج المهارات ومتابعة العروض</p>
        </div>
        {canEdit && <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all" style={addBtnStyle}>
          <Plus className="w-4 h-4" /> إضافة مرشح
        </button>}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse bg-muted" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon="🔍" title="لا يوجد مرشحون" description="أضف أول مرشح بالضغط على الزر أعلاه" />
      ) : (
        <div className="space-y-3">
          {data.map(c => <CandidateCard key={c.id} c={c} />)}
        </div>
      )}

      {showAdd && <AddCandidateModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
