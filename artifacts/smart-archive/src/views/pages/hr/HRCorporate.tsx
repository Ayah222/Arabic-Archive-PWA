import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, X, FileText, ShieldCheck, Mail as MailIcon, Trash2 } from "lucide-react";
import {
  usePolicies, useCreatePolicy, useDeletePolicy,
  useLicenses, useCreateLicense, useDeleteLicense,
  useCorrespondence, useCreateCorrespondence, useDeleteCorrespondence,
} from "../../../controllers/useHr";
import FileUpload from "../../components/shared/FileUpload";
import EmptyState from "../../components/shared/EmptyState";
import { getArchivePermissions } from "../../../controllers/permissions";

const inputCls = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm";
const addBtnStyle = { background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)", color: "#fff" };

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function AddModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 relative max-h-[90vh] overflow-y-auto" style={{ background: "rgba(12,10,25,0.97)" }}>
        <button onClick={onClose} className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        <h2 className="font-bold text-lg mb-4 text-center">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function PoliciesTab() {
  const { canEdit } = getArchivePermissions();
  const { data } = usePolicies();
  const create = useCreatePolicy();
  const del = useDeletePolicy();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", description: "", effectiveDate: "" });
  const [file, setFile] = useState<{ url: string } | null>(null);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    await create.mutateAsync({ title: form.title, category: form.category || null, description: form.description || null, effectiveDate: form.effectiveDate || null, fileUrl: file?.url || null });
    setShowAdd(false); setForm({ title: "", category: "", description: "", effectiveDate: "" }); setFile(null);
  };

  return (
    <div className="space-y-4">
      {canEdit && <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={addBtnStyle}><Plus className="w-4 h-4" /> إضافة سياسة</button>}
      {!data?.length ? <EmptyState icon="📘" title="لا توجد سياسات مضافة" /> : (
        <div className="space-y-2">
          {data.map(p => (
            <div key={p.id} className="liquid-glass-card rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.category || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {p.fileUrl && <a href={p.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline text-cyan-400">عرض الملف</a>}
                {canEdit && <button onClick={() => del.mutate(p.id)} className="text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <AddModal title="إضافة سياسة" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان السياسة *" className={inputCls} />
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="التصنيف (اختياري)" className={inputCls} />
            <input type="date" dir="ltr" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} className={inputCls} />
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="وصف مختصر" className={`${inputCls} resize-none`} />
            <FileUpload onUpload={setFile} projectId="hr" section="hr-policies" label={file ? "تم رفع الملف ✓" : "رفع ملف السياسة (اختياري)"} />
            <button onClick={handleSubmit} disabled={create.isPending || !form.title.trim()} className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={addBtnStyle}>
              {create.isPending ? "جاري الحفظ..." : "حفظ السياسة"}
            </button>
          </div>
        </AddModal>
      )}
    </div>
  );
}

function LicensesTab() {
  const { canEdit } = getArchivePermissions();
  const { data } = useLicenses();
  const create = useCreateLicense();
  const del = useDeleteLicense();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", licenseNumber: "", issuingAuthority: "", issueDate: "", expiryDate: "", notes: "" });
  const [file, setFile] = useState<{ url: string } | null>(null);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    await create.mutateAsync({
      name: form.name, licenseNumber: form.licenseNumber || null, issuingAuthority: form.issuingAuthority || null,
      issueDate: form.issueDate || null, expiryDate: form.expiryDate || null, notes: form.notes || null, fileUrl: file?.url || null,
    });
    setShowAdd(false); setForm({ name: "", licenseNumber: "", issuingAuthority: "", issueDate: "", expiryDate: "", notes: "" }); setFile(null);
  };

  return (
    <div className="space-y-4">
      {canEdit && <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={addBtnStyle}><Plus className="w-4 h-4" /> إضافة ترخيص</button>}
      {!data?.length ? <EmptyState icon="🛡️" title="لا توجد تراخيص مضافة" /> : (
        <div className="space-y-2">
          {data.map(l => {
            const d = daysUntil(l.expiryDate);
            const soon = d !== null && d <= 30;
            return (
              <div key={l.id} className="liquid-glass-card rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ShieldCheck className={`w-5 h-5 shrink-0 ${soon ? "text-yellow-400" : "text-emerald-400"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.issuingAuthority || "—"} {l.expiryDate ? `· ينتهي ${l.expiryDate}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {soon && <span className="px-2 py-0.5 rounded-md text-[11px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/25">قارب على الانتهاء</span>}
                  {l.fileUrl && <a href={l.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline text-cyan-400">عرض الملف</a>}
                  {canEdit && <button onClick={() => del.mutate(l.id)} className="text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showAdd && (
        <AddModal title="إضافة ترخيص حكومي" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم الترخيص *" className={inputCls} />
            <input value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} placeholder="رقم الترخيص" dir="ltr" className={inputCls} />
            <input value={form.issuingAuthority} onChange={e => setForm(f => ({ ...f, issuingAuthority: e.target.value }))} placeholder="الجهة المصدرة" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" dir="ltr" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} className={inputCls} />
              <input type="date" dir="ltr" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className={inputCls} />
            </div>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="ملاحظات" className={`${inputCls} resize-none`} />
            <FileUpload onUpload={setFile} projectId="hr" section="hr-licenses" label={file ? "تم رفع الملف ✓" : "رفع ملف الترخيص (اختياري)"} />
            <button onClick={handleSubmit} disabled={create.isPending || !form.name.trim()} className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={addBtnStyle}>
              {create.isPending ? "جاري الحفظ..." : "حفظ الترخيص"}
            </button>
          </div>
        </AddModal>
      )}
    </div>
  );
}

function CorrespondenceTab() {
  const { canEdit } = getArchivePermissions();
  const { data } = useCorrespondence();
  const create = useCreateCorrespondence();
  const del = useDeleteCorrespondence();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ subject: "", direction: "outgoing", authority: "", date: "", reference: "", notes: "" });
  const [file, setFile] = useState<{ url: string } | null>(null);

  const handleSubmit = async () => {
    if (!form.subject.trim()) return;
    await create.mutateAsync({
      subject: form.subject, direction: form.direction as any, authority: form.authority || null,
      date: form.date || null, reference: form.reference || null, notes: form.notes || null, fileUrl: file?.url || null,
    });
    setShowAdd(false); setForm({ subject: "", direction: "outgoing", authority: "", date: "", reference: "", notes: "" }); setFile(null);
  };

  return (
    <div className="space-y-4">
      {canEdit && <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={addBtnStyle}><Plus className="w-4 h-4" /> إضافة مراسلة</button>}
      {!data?.length ? <EmptyState icon="✉️" title="لا توجد مراسلات مضافة" /> : (
        <div className="space-y-2">
          {data.map(c => (
            <div key={c.id} className="liquid-glass-card rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <MailIcon className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.subject}</p>
                  <p className="text-xs text-muted-foreground">{c.direction === "incoming" ? "وارد" : "صادر"} · {c.authority || "—"} {c.date ? `· ${c.date}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {c.fileUrl && <a href={c.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline text-cyan-400">عرض الملف</a>}
                {canEdit && <button onClick={() => del.mutate(c.id)} className="text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <AddModal title="إضافة مراسلة حكومية" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="الموضوع *" className={inputCls} />
            <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} className={inputCls}>
              <option value="outgoing">صادر</option>
              <option value="incoming">وارد</option>
            </select>
            <input value={form.authority} onChange={e => setForm(f => ({ ...f, authority: e.target.value }))} placeholder="الجهة الحكومية" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" dir="ltr" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
              <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="رقم المرجع" dir="ltr" className={inputCls} />
            </div>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="ملاحظات" className={`${inputCls} resize-none`} />
            <FileUpload onUpload={setFile} projectId="hr" section="hr-correspondence" label={file ? "تم رفع الملف ✓" : "رفع الملف (اختياري)"} />
            <button onClick={handleSubmit} disabled={create.isPending || !form.subject.trim()} className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={addBtnStyle}>
              {create.isPending ? "جاري الحفظ..." : "حفظ المراسلة"}
            </button>
          </div>
        </AddModal>
      )}
    </div>
  );
}

export default function HRCorporate() {
  const [tab, setTab] = useState<"policies" | "licenses" | "correspondence">("policies");

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <Link to="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> الموارد البشرية
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-foreground">الشؤون الإدارية للشركة</h1>
        <p className="text-sm text-muted-foreground mt-1">السياسات، التراخيص الحكومية، والمراسلات الرسمية</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab("policies")} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === "policies" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>السياسات</button>
        <button onClick={() => setTab("licenses")} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === "licenses" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>التراخيص</button>
        <button onClick={() => setTab("correspondence")} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === "correspondence" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>المراسلات</button>
      </div>

      {tab === "policies" && <PoliciesTab />}
      {tab === "licenses" && <LicensesTab />}
      {tab === "correspondence" && <CorrespondenceTab />}
    </div>
  );
}
