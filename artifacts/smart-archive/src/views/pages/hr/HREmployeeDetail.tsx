import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, FileText, Trash2, CalendarDays, Plus, X, Sparkles } from "lucide-react";
import {
  useEmployee, useUpdateEmployee,
  useEmployeeDocuments, useCreateEmployeeDocument, useDeleteEmployeeDocument, useSuggestDocumentCategory,
  useEmployeeLeaves, useCreateEmployeeLeave, useDeleteEmployeeLeave,
  type HRDocumentCategory,
} from "../../../controllers/useHr";
import FileUpload from "../../components/shared/FileUpload";
import EmptyState from "../../components/shared/EmptyState";
import { getArchivePermissions } from "../../../controllers/permissions";

const inputCls = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm";
const addBtnStyle = { background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)", color: "#fff" };

const CATEGORIES: { key: HRDocumentCategory; label: string }[] = [
  { key: "personal", label: "مستندات شخصية" },
  { key: "contract", label: "العقد" },
  { key: "qualifications", label: "المؤهلات" },
  { key: "performance", label: "الأداء" },
];

const STATUS_LABEL: Record<string, string> = { active: "نشط", on_leave: "في إجازة", terminated: "منتهي الخدمة" };

function DocumentsTab({ employeeId }: { employeeId: string }) {
  const { canEdit } = getArchivePermissions();
  const { data: docs } = useEmployeeDocuments(employeeId);
  const createDoc = useCreateEmployeeDocument(employeeId);
  const deleteDoc = useDeleteEmployeeDocument(employeeId);
  const suggest = useSuggestDocumentCategory();

  const [activeCat, setActiveCat] = useState<HRDocumentCategory>("personal");
  const [pendingFile, setPendingFile] = useState<{ url: string; filename: string; size: number; mimetype: string } | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [description, setDescription] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  const handleUpload = async (result: { url: string; filename: string; size: number; mimetype: string }) => {
    setPendingFile(result);
    setSuggesting(true);
    try {
      const res = await suggest.mutateAsync({ filename: result.filename });
      setActiveCat(res.category);
    } catch { /* keep current tab */ }
    setSuggesting(false);
  };

  const handleSave = async () => {
    if (!pendingFile) return;
    await createDoc.mutateAsync({
      category: activeCat,
      name: pendingFile.filename,
      url: pendingFile.url,
      mimeType: pendingFile.mimetype,
      size: pendingFile.size,
      description: description || null,
      expiryDate: expiryDate || null,
    });
    setPendingFile(null);
    setExpiryDate("");
    setDescription("");
  };

  const catDocs = (docs ?? []).filter(d => d.category === activeCat);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setActiveCat(c.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              activeCat === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}>
            {c.label} {docs?.filter(d => d.category === c.key).length ? `(${docs.filter(d => d.category === c.key).length})` : ""}
          </button>
        ))}
      </div>

      {canEdit && (
        <div className="liquid-glass-card rounded-2xl p-4 space-y-3">
          <FileUpload onUpload={handleUpload} projectId="hr" section="hr-employee-documents" label="رفع مستند" endpoint="/api/sa/hr/upload" />
          {suggesting && <p className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles className="w-3 h-3 animate-pulse" /> جاري اقتراح التصنيف...</p>}
          {pendingFile && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">الملف: {pendingFile.filename} — سيُحفظ في تصنيف "{CATEGORIES.find(c => c.key === activeCat)?.label}"</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" dir="ltr" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} placeholder="تاريخ الانتهاء (إن وجد)" className={inputCls} />
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف مختصر (اختياري)" className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={createDoc.isPending} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={addBtnStyle}>
                  {createDoc.isPending ? "جاري الحفظ..." : "حفظ المستند"}
                </button>
                <button onClick={() => setPendingFile(null)} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted">إلغاء</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!catDocs.length ? (
        <EmptyState icon="📄" title="لا توجد مستندات في هذا التصنيف" />
      ) : (
        <div className="space-y-2">
          {catDocs.map(d => (
            <div key={d.id} className="liquid-glass-card rounded-xl p-4 flex items-center justify-between gap-3">
              <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 min-w-0 hover:underline">
                <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.description || d.name}</p>
                  {d.expiryDate && <p className="text-xs text-muted-foreground">ينتهي في {d.expiryDate}</p>}
                </div>
              </a>
              {canEdit && (
                <button onClick={() => deleteDoc.mutate(d.id)} className="text-red-400 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeavesTab({ employeeId }: { employeeId: string }) {
  const { canEdit } = getArchivePermissions();
  const { data: leaves } = useEmployeeLeaves(employeeId);
  const createLeave = useCreateEmployeeLeave(employeeId);
  const deleteLeave = useDeleteEmployeeLeave(employeeId);
  const [form, setForm] = useState({ leaveType: "سنوية", startDate: "", endDate: "", notes: "" });

  const handleAdd = async () => {
    if (!form.startDate || !form.endDate) return;
    await createLeave.mutateAsync({ leaveType: form.leaveType, startDate: form.startDate, endDate: form.endDate, notes: form.notes || null });
    setForm({ leaveType: "سنوية", startDate: "", endDate: "", notes: "" });
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="liquid-glass-card rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))} className={inputCls}>
              <option value="سنوية">إجازة سنوية</option>
              <option value="مرضية">إجازة مرضية</option>
              <option value="طارئة">إجازة طارئة</option>
              <option value="أخرى">أخرى</option>
            </select>
            <input type="date" dir="ltr" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} />
            <input type="date" dir="ltr" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inputCls} />
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات" className={inputCls} />
          </div>
          <button onClick={handleAdd} disabled={createLeave.isPending || !form.startDate || !form.endDate}
            className="w-full md:w-auto px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={addBtnStyle}>
            <Plus className="w-4 h-4 inline ml-1" /> إضافة إجازة
          </button>
        </div>
      )}
      {!leaves?.length ? (
        <EmptyState icon="🏖️" title="لا توجد إجازات مسجلة" />
      ) : (
        <div className="space-y-2">
          {leaves.map(l => (
            <div key={l.id} className="liquid-glass-card rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm font-medium">{l.leaveType}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{l.startDate} → {l.endDate}</p>
                </div>
              </div>
              {canEdit && <button onClick={() => deleteLeave.mutate(l.id)} className="text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HREmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const { canEdit } = getArchivePermissions();
  const { data: emp, isLoading } = useEmployee(id);
  const updateEmployee = useUpdateEmployee();
  const [tab, setTab] = useState<"documents" | "leaves">("documents");

  if (isLoading || !emp) {
    return <div className="p-4 md:p-8 max-w-4xl mx-auto"><div className="h-40 rounded-2xl animate-pulse bg-muted" /></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <Link to="/hr/employees" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> الموظفون
      </Link>

      <div className="liquid-glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">{emp.name}</h1>
            <p className="text-sm text-muted-foreground">{emp.position || "—"} {emp.department ? `· ${emp.department}` : ""}</p>
          </div>
          {canEdit && (
            <select value={emp.status} onChange={e => updateEmployee.mutate({ id: emp.id, status: e.target.value as any })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-background">
              <option value="active">نشط</option>
              <option value="on_leave">في إجازة</option>
              <option value="terminated">منتهي الخدمة</option>
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
          <div><p className="text-muted-foreground/70">الهاتف</p><p className="text-foreground" dir="ltr">{emp.phone || "—"}</p></div>
          <div><p className="text-muted-foreground/70">البريد</p><p className="text-foreground" dir="ltr">{emp.email || "—"}</p></div>
          <div><p className="text-muted-foreground/70">تاريخ التعيين</p><p className="text-foreground" dir="ltr">{emp.hireDate || "—"}</p></div>
          <div><p className="text-muted-foreground/70">مدة التجربة</p><p className="text-foreground">{emp.probationDays} يوم</p></div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab("documents")} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === "documents" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>الملف الرقمي</button>
        <button onClick={() => setTab("leaves")} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === "leaves" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>الإجازات</button>
      </div>

      {tab === "documents" ? <DocumentsTab employeeId={emp.id} /> : <LeavesTab employeeId={emp.id} />}
    </div>
  );
}
