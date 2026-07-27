import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAllContractors, useGlobalCreateContractor, useContractorRating } from "../../controllers/useGlobal";
import { useProjects } from "../../controllers/useProjects";
import EmptyState from "../components/shared/EmptyState";
import { HardHat, Phone, Mail, ExternalLink, Star, X, Plus } from "lucide-react";

const inputCls = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm";
const btnPrimary = "w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 mt-2";

/* ─── Rating colour ─── */
function ratingColor(v: number) {
  if (v >= 85) return "#22c55e";
  if (v >= 70) return "#00f0ff";
  if (v >= 55) return "#f59e0b";
  return "#ef4444";
}

/* ─── Rating Modal ─── */
function RatingModal({ contractor, onClose }: {
  contractor: { id: string; projectId: string; name: string; rating: { workQuality: number; scheduleCompliance: number; safetyStandards: number; executionSpeed: number } | null };
  onClose: () => void;
}) {
  const rate = useContractorRating(contractor.projectId);
  const [scores, setScores] = useState({
    workQuality: contractor.rating?.workQuality ?? 75,
    scheduleCompliance: contractor.rating?.scheduleCompliance ?? 75,
    safetyStandards: contractor.rating?.safetyStandards ?? 75,
    executionSpeed: contractor.rating?.executionSpeed ?? 75,
  });
  const avg = Math.round((scores.workQuality + scores.scheduleCompliance + scores.safetyStandards + scores.executionSpeed) / 4);

  const criteria = [
    { key: "workQuality" as const,       label: "جودة العمل",              color: "#00f0ff" },
    { key: "scheduleCompliance" as const, label: "الالتزام بالمواعيد",      color: "#a855f7" },
    { key: "safetyStandards" as const,   label: "معايير السلامة",           color: "#22c55e" },
    { key: "executionSpeed" as const,    label: "سرعة التنفيذ",             color: "#f59e0b" },
  ];

  const handleSave = async () => {
    await rate.mutateAsync({ cid: contractor.id, scores });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 relative" style={{ background: "rgba(12,10,25,0.97)" }}>
        <button onClick={onClose} className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        <div className="text-center mb-5">
          <div className="text-5xl font-black mb-1" style={{ color: ratingColor(avg) }}>{avg}</div>
          <p className="text-sm text-muted-foreground">المتوسط</p>
          <p className="font-bold mt-1">{contractor.name}</p>
          <p className="text-xs text-muted-foreground">تقييم الأداء</p>
        </div>
        <div className="space-y-4">
          {criteria.map(({ key, label, color }) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-semibold">{label}</span>
                <span className="font-black" style={{ color }}>{scores[key]}%</span>
              </div>
              <div className="relative h-2.5 rounded-full bg-white/10">
                <div className="absolute inset-y-0 right-0 rounded-full transition-all" style={{ width: `${scores[key]}%`, background: color }} />
              </div>
              <input type="range" min={0} max={100} value={scores[key]}
                onChange={e => setScores(s => ({ ...s, [key]: Number(e.target.value) }))}
                className="w-full mt-1.5 accent-primary cursor-pointer" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleSave} disabled={rate.isPending}
            className="flex-1 py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #00f0ff, #7000ff)" }}>
            {rate.isPending ? "جاري الحفظ..." : "حفظ التقييم"}
          </button>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold border border-border hover:bg-muted transition-colors">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Contractor Modal ─── */
function AddContractorModal({ onClose }: { onClose: () => void }) {
  const { data: projects } = useProjects();
  const create = useGlobalCreateContractor();
  const [form, setForm] = useState({ projectId: "", name: "", specialty: "", phone: "", email: "", notes: "" });

  const handleSubmit = async () => {
    if (!form.projectId || !form.name.trim() || !form.specialty.trim()) return;
    await create.mutateAsync({
      projectId: form.projectId,
      data: { name: form.name, specialty: form.specialty, phone: form.phone || null, email: form.email || null, status: "active", notes: form.notes || null },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 relative" style={{ background: "rgba(12,10,25,0.97)" }}>
        <button onClick={onClose} className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        <h2 className="font-bold text-lg mb-4 text-center">إضافة مقاول</h2>
        <div className="space-y-3">
          <div><label className="block text-sm font-medium mb-1">المشروع *</label>
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputCls} dir="rtl">
              <option value="">اختر المشروع</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium mb-1">الاسم *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم المقاول" className={inputCls} dir="rtl" />
          </div>
          <div><label className="block text-sm font-medium mb-1">التخصص *</label>
            <input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} placeholder="مهندس مدني، كهربائي..." className={inputCls} dir="rtl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">الهاتف</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05XXXXXXXX" className={inputCls} dir="ltr" />
            </div>
            <div><label className="block text-sm font-medium mb-1">البريد</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className={inputCls} dir="ltr" />
            </div>
          </div>
          <div><label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} dir="rtl" />
          </div>
          <button onClick={handleSubmit} disabled={create.isPending || !form.projectId || !form.name.trim() || !form.specialty.trim()} className={btnPrimary}>
            {create.isPending ? "جاري الإضافة..." : "إضافة المقاول"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function AllContractors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [ratingContractor, setRatingContractor] = useState<{ id: string; projectId: string; name: string; rating: { workQuality: number; scheduleCompliance: number; safetyStandards: number; executionSpeed: number } | null } | null>(null);
  const { data, isLoading } = useAllContractors(q || undefined);

  // Auto-open add modal if ?add=1
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
          <h1 className="text-2xl font-bold text-foreground">المقاولون</h1>
          <p className="text-sm text-muted-foreground mt-1">جميع المقاولين عبر المشاريع</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.18), rgba(112,0,255,0.18))", border: "1px solid rgba(0,240,255,0.35)", color: "#00f0ff" }}>
          <Plus className="w-4 h-4" /> إضافة مقاول
        </button>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث عن مقاول..."
        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        dir="rtl" />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-2xl animate-pulse bg-muted" />)}
        </div>
      ) : !data?.length ? (
        <EmptyState icon="👷" title="لا يوجد مقاولون" description="أضف أول مقاول بالضغط على الزر أعلاه" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(c => (
            <div key={c.id} className="liquid-glass-card rounded-2xl p-5 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.18) 0%, rgba(112,0,255,0.14) 100%)", border: "1px solid rgba(0,240,255,0.25)" }}>
                  <HardHat className="w-6 h-6" style={{ color: "#00f0ff" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground truncate">{c.name}</h3>
                    {c.rating && (
                      <span className="text-xs font-black px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: `${ratingColor(c.rating.average)}22`, color: ratingColor(c.rating.average), border: `1px solid ${ratingColor(c.rating.average)}44` }}>
                        ⭐ {c.rating.average}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.specialty}</p>
                  <Link to={`/projects/${c.projectId}`}
                    className="text-xs mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity"
                    style={{ color: "#00f0ff" }}>
                    <ExternalLink className="w-3 h-3" />{c.projectName}
                  </Link>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${c.status === "active" ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/25" : "text-muted-foreground bg-muted"}`}>
                  {c.status === "active" ? "نشط" : "غير نشط"}
                </span>
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
              </div>

              {/* Rating bars */}
              {c.rating && (
                <div className="space-y-1.5 border-t border-border pt-3">
                  {[
                    { label: "جودة العمل", val: c.rating.workQuality, color: "#00f0ff" },
                    { label: "الالتزام", val: c.rating.scheduleCompliance, color: "#a855f7" },
                    { label: "السلامة", val: c.rating.safetyStandards, color: "#22c55e" },
                    { label: "التنفيذ", val: c.rating.executionSpeed, color: "#f59e0b" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0 text-left">{val}%</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${val}%`, background: color }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-14 shrink-0 text-right">{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes + rating button */}
              <div className="flex items-center justify-between mt-auto pt-1">
                {c.notes && <p className="text-xs text-muted-foreground italic flex-1 truncate">{c.notes}</p>}
                <button
                  onClick={() => setRatingContractor({ id: c.id, projectId: c.projectId, name: c.name, rating: c.rating })}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 shrink-0 mr-2"
                  style={{ background: "rgba(112,0,255,0.15)", color: "#a855f7", border: "1px solid rgba(112,0,255,0.25)" }}>
                  <Star className="w-3.5 h-3.5" />
                  {c.rating ? "تعديل التقييم" : "تقييم الأداء"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddContractorModal onClose={() => setShowAdd(false)} />}
      {ratingContractor && <RatingModal contractor={ratingContractor} onClose={() => setRatingContractor(null)} />}
    </div>
  );
}
