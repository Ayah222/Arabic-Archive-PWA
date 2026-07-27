import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useProject } from "../../controllers/useProjects";
import {
  useContracts,
  useProjectContractors,
  useDocuments,
  useMeetings,
  useLetters,
} from "../../controllers/useProjectDetails";
import { useContacts, useContactActions, useDocumentActions } from "../../controllers/useGlobal";
import ProgressBar from "../components/shared/ProgressBar";
import StatusBadge from "../components/shared/StatusBadge";
import Modal from "../components/shared/Modal";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import EmptyState from "../components/shared/EmptyState";
import FileUpload from "../components/shared/FileUpload";
import Toast from "../components/shared/Toast";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ICONS,
  formatCurrency,
  formatDate,
  type ProjectStatus,
  type ContractStatus,
  type DocumentType,
  type LetterDirection,
} from "../../models/types";

type Tab = "contracts" | "contractors" | "documents" | "meetings" | "letters" | "contacts";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "contracts", label: "العقود", icon: "📋" },
  { id: "contractors", label: "المقاولون", icon: "👷" },
  { id: "documents", label: "الملفات الفنية", icon: "📄" },
  { id: "meetings", label: "الاجتماعات", icon: "🤝" },
  { id: "letters", label: "الخطابات", icon: "✉️" },
  { id: "contacts", label: "جهات الاتصال", icon: "👤" },
];

export default function ProjectDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("contracts");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { data: project, isLoading, isError } = useProject(id);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="h-10 bg-muted rounded-xl animate-pulse w-32" />
        <div className="h-40 bg-muted rounded-2xl animate-pulse" />
        <div className="h-12 bg-muted rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-muted-foreground mb-4">المشروع غير موجود</p>
        <Link to="/projects" className="text-primary hover:underline">العودة للمشاريع</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto" dir="rtl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-card border-b border-border px-4 md:px-8 py-5 sticky top-0 md:top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/projects")}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1"
          >
            ← المشاريع
          </button>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{project.client}</p>
          </div>
          <StatusBadge
            label={PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
            colorClass={PROJECT_STATUS_COLORS[project.status as ProjectStatus]}
            size="md"
          />
        </div>
        <div className="mt-3">
          <ProgressBar value={project.progress} showLabel size="lg" />
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
          {project.location && <span>📍 {project.location}</span>}
          <span>📅 {formatDate(project.startDate)}</span>
          {project.budget && <span>💰 {formatCurrency(project.budget)}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-8 pt-4">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-150 ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 md:p-8 pt-4">
        {activeTab === "contracts" && (
          <ContractsTab projectId={id} setToast={setToast} />
        )}
        {activeTab === "contractors" && (
          <ContractorsTab projectId={id} setToast={setToast} />
        )}
        {activeTab === "documents" && (
          <DocumentsTab projectId={id} setToast={setToast} />
        )}
        {activeTab === "meetings" && (
          <MeetingsTab projectId={id} setToast={setToast} />
        )}
        {activeTab === "letters" && (
          <LettersTab projectId={id} setToast={setToast} />
        )}
        {activeTab === "contacts" && (
          <ContactsTab projectId={id} setToast={setToast} />
        )}
      </div>
    </div>
  );
}

/* ===== CONTRACTS TAB ===== */
function ContractsTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, update, remove } = useContracts(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<{ id: string; data: ContractFormData } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractFormData>(defaultContractForm);

  type ContractFormData = {
    title: string; party: string; value: string;
    startDate: string; endDate: string; status: ContractStatus; notes: string;
  };
  const defaultContractForm: ContractFormData = {
    title: "", party: "", value: "", startDate: "", endDate: "", status: "active", notes: ""
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.party.trim()) return;
    try {
      await create.mutateAsync({ id: projectId, data: { ...form, value: Number(form.value), notes: form.notes || null, fileUrl: null } });
      setShowCreate(false); setForm(defaultContractForm);
      setToast({ message: "تم إضافة العقد", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    try {
      await update.mutateAsync({ id: projectId, cid: editItem.id, data: { ...editItem.data, value: Number(editItem.data.value), notes: editItem.data.notes || null } });
      setEditItem(null);
      setToast({ message: "تم تحديث العقد", type: "success" });
    } catch { setToast({ message: "فشل في التحديث", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">العقود ({list.data?.length ?? 0})</h2>
        <button onClick={() => { setForm(defaultContractForm); setShowCreate(true); }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          + إضافة عقد
        </button>
      </div>
      {list.isLoading ? <LoadingSkeleton /> : !list.data?.length ? (
        <EmptyState icon="📋" title="لا توجد عقود" description="أضف أول عقد لهذا المشروع" />
      ) : (
        <div className="space-y-3">
          {list.data.map((c) => (
            <div key={c.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold">{c.title}</h3>
                <StatusBadge label={CONTRACT_STATUS_LABELS[c.status as ContractStatus]} colorClass={CONTRACT_STATUS_COLORS[c.status as ContractStatus]} />
              </div>
              <p className="text-sm text-muted-foreground">{c.party}</p>
              <p className="text-sm font-semibold text-primary mt-1">{formatCurrency(c.value)}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatDate(c.startDate)} — {formatDate(c.endDate)}</p>
              {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
              <div className="flex gap-4 mt-3 text-sm">
                <button onClick={() => setEditItem({ id: c.id, data: { title: c.title, party: c.party, value: c.value.toString(), startDate: c.startDate, endDate: c.endDate, status: c.status as ContractStatus, notes: c.notes ?? "" } })} className="text-primary hover:underline">تعديل</button>
                <button onClick={() => setDeleteId(c.id)} className="text-destructive hover:underline">حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="إضافة عقد">
        <ContractForm data={form} onChange={setForm} onSubmit={handleCreate} loading={create.isPending} submitLabel="إضافة العقد" />
      </Modal>
      {editItem && (
        <Modal isOpen onClose={() => setEditItem(null)} title="تعديل العقد">
          <ContractForm data={editItem.data} onChange={(d) => setEditItem({ ...editItem, data: d })} onSubmit={handleUpdate} loading={update.isPending} submitLabel="حفظ التعديلات" />
        </Modal>
      )}
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove.mutateAsync({ id: projectId, cid: deleteId! }); setDeleteId(null); setToast({ message: "تم حذف العقد", type: "success" }); }} title="حذف العقد" message="هل أنت متأكد من حذف هذا العقد؟" confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

type ContractFormData = { title: string; party: string; value: string; startDate: string; endDate: string; status: ContractStatus; notes: string; };
function ContractForm({ data, onChange, onSubmit, loading, submitLabel }: { data: ContractFormData; onChange: (d: ContractFormData) => void; onSubmit: () => void; loading: boolean; submitLabel: string }) {
  const set = (k: keyof ContractFormData, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <FormField label="عنوان العقد *"><input value={data.title} onChange={(e) => set("title", e.target.value)} placeholder="عنوان العقد" className={inputCls} dir="rtl" /></FormField>
      <FormField label="الطرف الآخر *"><input value={data.party} onChange={(e) => set("party", e.target.value)} placeholder="اسم الشركة أو المقاول" className={inputCls} dir="rtl" /></FormField>
      <FormField label="قيمة العقد (ريال)"><input type="number" value={data.value} onChange={(e) => set("value", e.target.value)} placeholder="0" className={inputCls} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="تاريخ البداية"><input type="date" value={data.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputCls} /></FormField>
        <FormField label="تاريخ الانتهاء"><input type="date" value={data.endDate} onChange={(e) => set("endDate", e.target.value)} className={inputCls} /></FormField>
      </div>
      <FormField label="الحالة">
        <select value={data.status} onChange={(e) => set("status", e.target.value)} className={inputCls} dir="rtl">
          {(["active","completed","pending","cancelled"] as ContractStatus[]).map((s) => <option key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</option>)}
        </select>
      </FormField>
      <FormField label="ملاحظات"><textarea value={data.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
      <button onClick={onSubmit} disabled={loading || !data.title.trim()} className={btnCls}>{loading ? "جاري..." : submitLabel}</button>
    </div>
  );
}

/* ===== CONTRACTORS TAB ===== */
function ContractorsTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, update, remove } = useProjectContractors(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<{ id: string; data: ContractorFormData } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractorFormData>(defaultContractorForm);

  type ContractorFormData = { name: string; specialty: string; phone: string; email: string; status: "active" | "inactive"; notes: string; };
  const defaultContractorForm: ContractorFormData = { name: "", specialty: "", phone: "", email: "", status: "active", notes: "" };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.specialty.trim()) return;
    try {
      await create.mutateAsync({ id: projectId, data: { ...form, phone: form.phone || null, email: form.email || null, notes: form.notes || null } });
      setShowCreate(false); setForm(defaultContractorForm);
      setToast({ message: "تم إضافة المقاول", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">المقاولون ({list.data?.length ?? 0})</h2>
        <button onClick={() => { setForm(defaultContractorForm); setShowCreate(true); }} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ إضافة مقاول</button>
      </div>
      {list.isLoading ? <LoadingSkeleton /> : !list.data?.length ? (
        <EmptyState icon="👷" title="لا يوجد مقاولون" description="أضف مقاول للمشروع" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.data.map((c) => (
            <div key={c.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-sm text-primary">{c.specialty}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{c.status === "active" ? "نشط" : "غير نشط"}</span>
              </div>
              {c.phone && <p className="text-xs text-muted-foreground">📞 {c.phone}</p>}
              {c.email && <p className="text-xs text-muted-foreground">✉️ {c.email}</p>}
              {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
              <div className="flex gap-4 mt-3 text-sm">
                <button onClick={() => setEditItem({ id: c.id, data: { name: c.name, specialty: c.specialty, phone: c.phone ?? "", email: c.email ?? "", status: c.status as "active"|"inactive", notes: c.notes ?? "" } })} className="text-primary hover:underline">تعديل</button>
                <button onClick={() => setDeleteId(c.id)} className="text-destructive hover:underline">حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="إضافة مقاول">
        <ContractorForm data={form} onChange={setForm} onSubmit={handleCreate} loading={create.isPending} submitLabel="إضافة المقاول" />
      </Modal>
      {editItem && (
        <Modal isOpen onClose={() => setEditItem(null)} title="تعديل المقاول">
          <ContractorForm
            data={editItem.data}
            onChange={(d) => setEditItem({ ...editItem, data: d })}
            onSubmit={async () => {
              try {
                await update.mutateAsync({ id: projectId, cid: editItem.id, data: { ...editItem.data, phone: editItem.data.phone || null, email: editItem.data.email || null, notes: editItem.data.notes || null } });
                setEditItem(null); setToast({ message: "تم تحديث المقاول", type: "success" });
              } catch { setToast({ message: "فشل في التحديث", type: "error" }); }
            }}
            loading={update.isPending}
            submitLabel="حفظ"
          />
        </Modal>
      )}
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove.mutateAsync({ id: projectId, cid: deleteId! }); setDeleteId(null); setToast({ message: "تم حذف المقاول", type: "success" }); }} title="حذف المقاول" message="هل أنت متأكد من حذف هذا المقاول؟" confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

type ContractorFormData = { name: string; specialty: string; phone: string; email: string; status: "active" | "inactive"; notes: string; };
function ContractorForm({ data, onChange, onSubmit, loading, submitLabel }: { data: ContractorFormData; onChange: (d: ContractorFormData) => void; onSubmit: () => void; loading: boolean; submitLabel: string }) {
  const set = (k: keyof ContractorFormData, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <FormField label="الاسم *"><input value={data.name} onChange={(e) => set("name", e.target.value)} placeholder="اسم المقاول" className={inputCls} dir="rtl" /></FormField>
      <FormField label="التخصص *"><input value={data.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="مهندس مدني، كهربائي..." className={inputCls} dir="rtl" /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="الهاتف"><input value={data.phone} onChange={(e) => set("phone", e.target.value)} placeholder="05XXXXXXXX" className={inputCls} dir="ltr" /></FormField>
        <FormField label="البريد الإلكتروني"><input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" className={inputCls} dir="ltr" /></FormField>
      </div>
      <FormField label="الحالة">
        <select value={data.status} onChange={(e) => set("status", e.target.value)} className={inputCls} dir="rtl">
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
      </FormField>
      <FormField label="ملاحظات"><textarea value={data.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
      <button onClick={onSubmit} disabled={loading || !data.name.trim()} className={btnCls}>{loading ? "جاري..." : submitLabel}</button>
    </div>
  );
}

/* ===== DOCUMENTS TAB ===== */
function DocumentsTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, remove } = useDocuments(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [docName, setDocName] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; filename: string; size: number; mimetype: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getTypeFromMime = (mime: string): DocumentType => {
    if (mime === "application/pdf") return "pdf";
    if (mime.startsWith("image/")) return "image";
    if (mime.includes("word")) return "word";
    if (mime.includes("excel") || mime.includes("spreadsheet")) return "excel";
    return "other";
  };

  const handleCreate = async () => {
    if (!docName.trim() || !uploadedFile) return;
    try {
      await create.mutateAsync({ id: projectId, data: { name: docName, type: getTypeFromMime(uploadedFile.mimetype), url: uploadedFile.url, size: uploadedFile.size, notes: docNotes || null } });
      setShowCreate(false); setDocName(""); setDocNotes(""); setUploadedFile(null);
      setToast({ message: "تم إضافة المستند", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">المستندات ({list.data?.length ?? 0})</h2>
        <button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ رفع مستند</button>
      </div>
      {list.isLoading ? <LoadingSkeleton /> : !list.data?.length ? (
        <EmptyState icon="📄" title="لا توجد مستندات" description="ارفع أول مستند لهذا المشروع" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.data.map((d) => (
            <div key={d.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-start gap-3">
              <span className="text-3xl mt-0.5">{DOCUMENT_TYPE_ICONS[d.type as DocumentType]}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{d.name}</h3>
                <p className="text-xs text-muted-foreground">{DOCUMENT_TYPE_LABELS[d.type as DocumentType]}{d.size ? ` · ${(d.size / 1024).toFixed(0)}KB` : ""}</p>
                {d.notes && <p className="text-xs text-muted-foreground mt-1 italic">{d.notes}</p>}
                <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</p>
                {/* Prompt 2: Revision + Approval */}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {"revisions" in d && Array.isArray((d as { revisions?: unknown[] }).revisions) && (
                    <span className="text-xs font-mono text-muted-foreground">Rev {(d as { currentRevision?: number }).currentRevision ?? 0}</span>
                  )}
                  {"approvalStatus" in d && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      (d as { approvalStatus?: string }).approvalStatus === "approved" ? "bg-green-500/15 text-green-400" :
                      (d as { approvalStatus?: string }).approvalStatus === "rejected" ? "bg-red-500/15 text-red-400" :
                      (d as { approvalStatus?: string }).approvalStatus === "approved_with_notes" ? "bg-orange-500/15 text-orange-400" :
                      "bg-yellow-500/15 text-yellow-400"
                    }`}>
                      {(d as { approvalStatus?: string }).approvalStatus === "approved" ? "معتمد" :
                       (d as { approvalStatus?: string }).approvalStatus === "rejected" ? "مرفوض" :
                       (d as { approvalStatus?: string }).approvalStatus === "approved_with_notes" ? "معتمد مع ملاحظات" :
                       "قيد المراجعة"}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setDeleteId(d.id)} className="text-destructive hover:underline text-xs flex-shrink-0">حذف</button>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="رفع مستند">
        <div className="space-y-4">
          <FormField label="اسم المستند *">
            <input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="اسم المستند" className={inputCls} dir="rtl" />
          </FormField>
          <FileUpload projectId={projectId} section="documents" label="رفع الملف" onUpload={(f) => { setUploadedFile(f); if (!docName) setDocName(f.filename.replace(/^\d+-/, "")); }} />
          {uploadedFile && <p className="text-sm text-green-600">✅ تم رفع: {uploadedFile.filename}</p>}
          <FormField label="ملاحظات"><textarea value={docNotes} onChange={(e) => setDocNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
          <button onClick={handleCreate} disabled={create.isPending || !docName.trim() || !uploadedFile} className={btnCls}>{create.isPending ? "جاري..." : "إضافة المستند"}</button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove.mutateAsync({ id: projectId, did: deleteId! }); setDeleteId(null); setToast({ message: "تم حذف المستند", type: "success" }); }} title="حذف المستند" message="هل أنت متأكد من حذف هذا المستند؟" confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

/* ===== MEETINGS TAB ===== */
function MeetingsTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, remove } = useMeetings(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<MeetingFormData>(defaultMeetingForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [attendeeInput, setAttendeeInput] = useState("");

  type MeetingFormData = { title: string; date: string; location: string; agenda: string; notes: string; attendees: string[]; };
  const defaultMeetingForm: MeetingFormData = { title: "", date: "", location: "", agenda: "", notes: "", attendees: [] };

  const addAttendee = () => {
    const name = attendeeInput.trim();
    if (name && !form.attendees.includes(name)) {
      setForm({ ...form, attendees: [...form.attendees, name] });
      setAttendeeInput("");
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.date) return;
    try {
      await create.mutateAsync({ id: projectId, data: { ...form, location: form.location || null, agenda: form.agenda || null, notes: form.notes || null } });
      setShowCreate(false); setForm(defaultMeetingForm);
      setToast({ message: "تم إضافة الاجتماع", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">الاجتماعات ({list.data?.length ?? 0})</h2>
        <button onClick={() => { setForm(defaultMeetingForm); setShowCreate(true); }} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ إضافة اجتماع</button>
      </div>
      {list.isLoading ? <LoadingSkeleton /> : !list.data?.length ? (
        <EmptyState icon="🤝" title="لا توجد اجتماعات" description="أضف أول اجتماع لهذا المشروع" />
      ) : (
        <div className="space-y-3">
          {list.data.map((m) => (
            <div key={m.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold">{m.title}</h3>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(m.date)}</span>
              </div>
              {m.location && <p className="text-sm text-muted-foreground">📍 {m.location}</p>}
              {m.attendees.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.attendees.map((a, i) => (
                    <span key={i} className="text-xs bg-secondary px-2 py-0.5 rounded-full">{a}</span>
                  ))}
                </div>
              )}
              {m.agenda && <p className="text-sm text-muted-foreground mt-2"><strong>الأجندة:</strong> {m.agenda}</p>}
              {m.notes && <p className="text-sm text-muted-foreground mt-1 italic">{m.notes}</p>}
              <button onClick={() => setDeleteId(m.id)} className="text-destructive hover:underline text-sm mt-3">حذف</button>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="إضافة اجتماع" size="lg">
        <div className="space-y-3">
          <FormField label="عنوان الاجتماع *"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان الاجتماع" className={inputCls} dir="rtl" /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="التاريخ *"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} /></FormField>
            <FormField label="الموقع"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="مكتب، موقع..." className={inputCls} dir="rtl" /></FormField>
          </div>
          <FormField label="الحضور">
            <div className="flex gap-2">
              <input value={attendeeInput} onChange={(e) => setAttendeeInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAttendee()} placeholder="اسم الحاضر..." className={`${inputCls} flex-1`} dir="rtl" />
              <button onClick={addAttendee} className="px-3 py-2 bg-secondary rounded-xl text-sm hover:bg-muted transition-colors">إضافة</button>
            </div>
            {form.attendees.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.attendees.map((a, i) => (
                  <span key={i} className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                    {a}
                    <button onClick={() => setForm({ ...form, attendees: form.attendees.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-foreground">×</button>
                  </span>
                ))}
              </div>
            )}
          </FormField>
          <FormField label="الأجندة"><textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
          <FormField label="ملاحظات"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
          <button onClick={handleCreate} disabled={create.isPending || !form.title.trim() || !form.date} className={btnCls}>{create.isPending ? "جاري..." : "إضافة الاجتماع"}</button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove.mutateAsync({ id: projectId, mid: deleteId! }); setDeleteId(null); setToast({ message: "تم حذف الاجتماع", type: "success" }); }} title="حذف الاجتماع" message="هل أنت متأكد؟" confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

/* ===== LETTERS TAB ===== */
function LettersTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, remove } = useLetters(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<LetterFormData>(defaultLetterForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  type LetterFormData = { subject: string; direction: LetterDirection; from: string; to: string; date: string; reference: string; notes: string; };
  const defaultLetterForm: LetterFormData = { subject: "", direction: "outgoing", from: "", to: "", date: "", reference: "", notes: "" };

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.from.trim() || !form.to.trim() || !form.date) return;
    try {
      await create.mutateAsync({ id: projectId, data: { ...form, reference: form.reference || null, notes: form.notes || null, fileUrl: null } });
      setShowCreate(false); setForm(defaultLetterForm);
      setToast({ message: "تم إضافة الخطاب", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">الخطابات ({list.data?.length ?? 0})</h2>
        <button onClick={() => { setForm(defaultLetterForm); setShowCreate(true); }} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ إضافة خطاب</button>
      </div>
      {list.isLoading ? <LoadingSkeleton /> : !list.data?.length ? (
        <EmptyState icon="✉️" title="لا توجد خطابات" description="أضف أول خطاب لهذا المشروع" />
      ) : (
        <div className="space-y-3">
          {list.data.map((l) => (
            <div key={l.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mr-0 ml-2 ${l.direction === "outgoing" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                    {l.direction === "outgoing" ? "⬆️ صادر" : "⬇️ وارد"}
                  </span>
                  <h3 className="font-semibold inline">{l.subject}</h3>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(l.date)}</span>
              </div>
              <p className="text-sm text-muted-foreground">من: <strong>{l.from}</strong> إلى: <strong>{l.to}</strong></p>
              {/* Prompt 1: autoRef + distributionStatus */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {"autoRef" in l && (l as { autoRef?: string }).autoRef && (
                  <span className="text-xs font-mono text-muted-foreground">{(l as { autoRef?: string }).autoRef}</span>
                )}
                {l.reference && <span className="text-xs text-muted-foreground">({l.reference})</span>}
                {"distributionStatus" in l && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    (l as { distributionStatus?: string }).distributionStatus === "received" ? "bg-green-500/15 text-green-400" :
                    (l as { distributionStatus?: string }).distributionStatus === "sent" ? "bg-blue-500/15 text-blue-400" :
                    "bg-gray-500/15 text-gray-400"
                  }`}>
                    {(l as { distributionStatus?: string }).distributionStatus === "received" ? "تم الاستلام" :
                     (l as { distributionStatus?: string }).distributionStatus === "sent" ? "تم الإرسال" : "لم يُرسل"}
                  </span>
                )}
              </div>
              {l.notes && <p className="text-sm text-muted-foreground mt-1 italic">{l.notes}</p>}
              <button onClick={() => setDeleteId(l.id)} className="text-destructive hover:underline text-sm mt-3">حذف</button>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="إضافة خطاب" size="lg">
        <div className="space-y-3">
          <FormField label="الموضوع *"><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="موضوع الخطاب" className={inputCls} dir="rtl" /></FormField>
          <FormField label="الاتجاه">
            <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as LetterDirection })} className={inputCls} dir="rtl">
              <option value="outgoing">⬆️ صادر</option>
              <option value="incoming">⬇️ وارد</option>
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="من *"><input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="المرسل" className={inputCls} dir="rtl" /></FormField>
            <FormField label="إلى *"><input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="المستلم" className={inputCls} dir="rtl" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="التاريخ *"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} /></FormField>
            <FormField label="رقم المرجع"><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="SA-2025-001" className={inputCls} dir="ltr" /></FormField>
          </div>
          <FormField label="حالة التوزيع (Prompt 1)">
            <select value={(form as { distributionStatus?: string }).distributionStatus ?? "not_sent"} onChange={(e) => setForm({ ...form, distributionStatus: e.target.value } as typeof form & { distributionStatus: string })} className={inputCls} dir="rtl">
              <option value="not_sent">لم يُرسل</option>
              <option value="sent">تم الإرسال</option>
              <option value="received">تم الاستلام</option>
            </select>
          </FormField>
          <FormField label="الجهات المستلمة">
            <div className="flex flex-wrap gap-2 mt-1">
              {(["owner","consultant","contractor","technical_office"] as const).map((r) => {
                const labels: Record<string, string> = { owner: "مالك", consultant: "استشاري", contractor: "مقاول", technical_office: "مكتب فني" };
                const selected = ((form as { recipients?: string[] }).recipients ?? []).includes(r);
                return (
                  <button key={r} type="button" onClick={() => {
                    const prev = (form as { recipients?: string[] }).recipients ?? [];
                    const next = selected ? prev.filter((x) => x !== r) : [...prev, r];
                    setForm({ ...form, recipients: next } as typeof form & { recipients: string[] });
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${selected ? "bg-primary/20 border-primary text-primary" : "bg-secondary border-border text-muted-foreground"}`}>
                    {labels[r]}
                  </button>
                );
              })}
            </div>
          </FormField>
          <FormField label="ملاحظات"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
          <p className="text-xs text-muted-foreground">سيتم توليد رقم مرجعي تلقائي (LTR-XXXX-XXX) عند الحفظ</p>
          <button onClick={handleCreate} disabled={create.isPending || !form.subject.trim() || !form.from.trim() || !form.to.trim() || !form.date} className={btnCls}>{create.isPending ? "جاري..." : "إضافة الخطاب"}</button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove.mutateAsync({ id: projectId, lid: deleteId! }); setDeleteId(null); setToast({ message: "تم حذف الخطاب", type: "success" }); }} title="حذف الخطاب" message="هل أنت متأكد؟" confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

/* ===== CONTACTS TAB (Prompt 5) ===== */
function ContactsTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { data, isLoading } = useContacts(projectId);
  const { create, remove } = useContactActions(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", role: "consultant", phone: "", email: "", notes: "" });

  const ROLE_LABELS: Record<string, string> = {
    owner: "مالك",
    consultant: "استشاري",
    contractor: "مقاول",
    technical_office: "مكتب فني",
    other: "أخرى",
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await create.mutateAsync({ name: form.name, role: form.role as "owner" | "consultant" | "contractor" | "technical_office" | "other", phone: form.phone || null, email: form.email || null, notes: form.notes || null });
      setShowCreate(false);
      setForm({ name: "", role: "consultant", phone: "", email: "", notes: "" });
      setToast({ message: "تم إضافة جهة الاتصال", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">جهات الاتصال ({data?.length ?? 0})</h2>
        <button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ إضافة جهة</button>
      </div>
      {isLoading ? <LoadingSkeleton /> : !data?.length ? (
        <EmptyState icon="👤" title="لا توجد جهات اتصال" description="أضف جهات الاتصال المرتبطة بهذا المشروع" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.map((c) => (
            <div key={c.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{ROLE_LABELS[c.role] ?? c.role}</span>
                </div>
              </div>
              {c.phone && <p className="text-xs text-muted-foreground mt-1">📞 {c.phone}</p>}
              {c.email && <p className="text-xs text-muted-foreground">✉️ {c.email}</p>}
              {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
              <button onClick={() => setDeleteId(c.id)} className="text-destructive hover:underline text-sm mt-3">حذف</button>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="إضافة جهة اتصال">
        <div className="space-y-3">
          <FormField label="الاسم *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الجهة أو الشخص" className={inputCls} dir="rtl" /></FormField>
          <FormField label="الدور">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls} dir="rtl">
              <option value="owner">مالك</option>
              <option value="consultant">استشاري</option>
              <option value="contractor">مقاول</option>
              <option value="technical_office">مكتب فني</option>
              <option value="other">أخرى</option>
            </select>
          </FormField>
          <FormField label="الهاتف"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05XXXXXXXX" className={inputCls} dir="ltr" /></FormField>
          <FormField label="البريد الإلكتروني"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="example@email.com" className={inputCls} dir="ltr" /></FormField>
          <FormField label="ملاحظات"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
          <button onClick={handleCreate} disabled={create.isPending || !form.name.trim()} className={btnCls}>{create.isPending ? "جاري..." : "إضافة الجهة"}</button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove.mutateAsync(deleteId!); setDeleteId(null); setToast({ message: "تم حذف جهة الاتصال", type: "success" }); }} title="حذف جهة الاتصال" message="هل أنت متأكد؟" confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

/* ===== SHARED HELPERS ===== */
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm";
const btnCls = "w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 mt-2";
