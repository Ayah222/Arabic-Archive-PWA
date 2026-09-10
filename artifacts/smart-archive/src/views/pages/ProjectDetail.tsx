import { useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useProject } from "../../controllers/useProjects";
import {
  useContracts,
  useProjectContractors,
  useDocuments,
  useMeetings,
  useLetters,
} from "../../controllers/useProjectDetails";
import { useContacts, useContactActions, useDocumentActions, useProjectPhotos, usePhotoActions, useEntityAttachments, useAttachmentActions, useUpdateProjectExtra, useCategories, useCategoryActions, type SAPhoto, type SAAttachment, type SACategory } from "../../controllers/useGlobal";
import ProgressBar from "../components/shared/ProgressBar";
import StatusBadge from "../components/shared/StatusBadge";
import Modal from "../components/shared/Modal";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import EmptyState from "../components/shared/EmptyState";
import FileUpload from "../components/shared/FileUpload";
import Toast from "../components/shared/Toast";
import { getArchivePermissions } from "../../controllers/permissions";
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

type StaticTab = "contracts" | "contractors" | "documents" | "meetings" | "letters" | "contacts" | "photos";
type Tab = StaticTab | string; // dynamic: "cat_<id>"

const STATIC_TABS: { id: StaticTab; label: string; icon: string }[] = [
  { id: "contracts",   label: "العقود",          icon: "📋" },
  { id: "contractors", label: "المقاولون",        icon: "👷" },
  { id: "documents",   label: "المخططات",         icon: "📐" },
  { id: "meetings",    label: "الاجتماعات",       icon: "🤝" },
  { id: "letters",     label: "الخطابات",         icon: "✉️" },
  { id: "contacts",    label: "جهات الاتصال",     icon: "👤" },
  { id: "photos",      label: "الصور",            icon: "🖼️" },
];

type PendingFolderUploadProps = {
  folderFiles: File[] | null;
  zipFile: File | null;
  onFolderChange: (files: File[] | null) => void;
  onZipChange: (file: File | null) => void;
};

type DirectoryEntry = {
  kind: "file" | "directory";
  name: string;
  getFile?: () => Promise<File>;
  values?: () => AsyncIterable<DirectoryEntry>;
};

async function readDirectoryFiles(directory: DirectoryEntry, parentPath = ""): Promise<File[]> {
  const files: File[] = [];
  if (!directory.values) return files;
  for await (const entry of directory.values()) {
    const relativePath = [parentPath, entry.name].filter(Boolean).join("/");
    if (entry.kind === "directory") {
      files.push(...await readDirectoryFiles(entry, relativePath));
    } else if (entry.getFile) {
      const source = await entry.getFile();
      const file = new File([source], source.name, { type: source.type, lastModified: source.lastModified });
      Object.defineProperty(file, "webkitRelativePath", { value: relativePath, configurable: true });
      files.push(file);
    }
  }
  return files;
}

function FolderPicker({
  files,
  onFiles,
  className = "block px-3 py-2.5 rounded-lg border border-dashed border-primary/40 text-xs text-center cursor-pointer hover:bg-primary/5 transition-colors",
  accept,
  label = "📂 إضافة مجلد كامل",
}: {
  files?: File[] | null;
  onFiles: (files: File[] | null) => void;
  className?: string;
  accept?: string;
  label?: string;
}) {
  const chooseFolder = async () => {
    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<DirectoryEntry>;
    }).showDirectoryPicker;
    if (picker) {
      try {
        const directory = await picker();
        const selectedFiles = await readDirectoryFiles(directory);
        onFiles(selectedFiles.length ? selectedFiles : null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
  };

  return (
    <label
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        const picker = (window as Window & {
          showDirectoryPicker?: () => Promise<DirectoryEntry>;
        }).showDirectoryPicker;
        const canUseNativeDirectoryPicker = Boolean(picker && window.top === window.self);
        if (canUseNativeDirectoryPicker) {
          event.preventDefault();
          void chooseFolder();
        }
      }}
    >
      {label}
      <input
        type="file"
        multiple
        accept={accept}
        className="hidden"
        {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={(event) => onFiles(event.target.files ? Array.from(event.target.files) : null)}
      />
      {files?.length ? <span className="block text-[10px] text-primary mt-1">{files.length} ملف</span> : null}
    </label>
  );
}

function PendingFolderUpload({ folderFiles, zipFile, onFolderChange, onZipChange }: PendingFolderUploadProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <FolderPicker files={folderFiles} onFiles={onFolderChange} />
      <label className="block px-3 py-2.5 rounded-lg border border-dashed border-primary/40 text-xs text-center cursor-pointer hover:bg-primary/5 transition-colors">
        🗜️ إضافة ZIP
        <input type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => onZipChange(e.target.files?.[0] ?? null)} />
        {zipFile && <span className="block text-[10px] text-primary mt-1 truncate">{zipFile.name}</span>}
      </label>
    </div>
  );
}

async function uploadPendingFolder(
  actions: ReturnType<typeof useAttachmentActions>,
  entityType: "contract" | "meeting" | "letter" | "custom_doc",
  entityId: string,
  folderFiles: File[] | null,
  zipFile: File | null,
  customType: string,
) {
  if (folderFiles?.length) {
    if (folderFiles.length > 10000) throw new Error("الحد الأقصى للمجلد هو 10000 ملف");
    for (const file of folderFiles) {
      const relativePath = file.webkitRelativePath || file.name;
      await actions.add.mutateAsync({ entityType, entityId, file, name: relativePath, customType, relativePath });
    }
  }
  if (zipFile) {
    await actions.addFolderZip.mutateAsync({ entityType, entityId, file: zipFile, customType, targetPath: "" });
  }
}

export default function ProjectDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => searchParams.get("tab") || "contracts");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<SACategory | null>(null);
  const { data: categories = [] } = useCategories(id);
  const { create: createCat, remove: removeCat } = useCategoryActions(id);
  const { canEdit, canDelete } = getArchivePermissions();

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
          {canEdit && <button
            onClick={() => navigate("/projects")}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1"
          >
            ← المشاريع
          </button>}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{project.client}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(`/projects/${id}/report`)}
              className="rounded-xl px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              تقرير PDF / طباعة
            </button>
            <StatusBadge
              label={PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
              colorClass={PROJECT_STATUS_COLORS[project.status as ProjectStatus]}
              size="md"
            />
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={project.progress} showLabel size="lg" />
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
          {project.location && <span>📍 {project.location}</span>}
          <span>📅 {formatDate(project.startDate)}</span>
          {project.budget && <span>💰 {formatCurrency(project.budget)}</span>}
          {(project as { mapsUrl?: string | null }).mapsUrl && (
            <a
              href={(project as { mapsUrl?: string | null }).mapsUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              🗺️ خريطة الموقع
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-8 pt-4">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {STATIC_TABS.map((tab) => (
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
          {/* Dynamic category tabs */}
          {categories.map((cat) => (
            <button
              key={`cat_${cat.id}`}
              onClick={() => setActiveTab(`cat_${cat.id}`)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-150 ${
                activeTab === `cat_${cat.id}`
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              <span>🗂️</span>
              <span>{cat.name}</span>
            </button>
          ))}
          {/* New Category button */}
          {canEdit && <button
            onClick={() => setShowNewCategory(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-all duration-150"
          >
            <span>➕</span>
            <span>فئة جديدة</span>
          </button>}
        </div>
      </div>

      {/* New Category Modal */}
        {canEdit && showNewCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => { setShowNewCategory(false); setNewCatName(""); }}>
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">إنشاء فئة جديدة</h3>
            <p className="text-sm text-muted-foreground">اختر اسماً للفئة مثل: ضمانات، تقارير، عروض أسعار، مواصفات...</p>
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCatName.trim()) {
                  createCat.mutateAsync(newCatName.trim()).then((cat) => {
                    setActiveTab(`cat_${cat.id}`);
                    setShowNewCategory(false);
                    setNewCatName("");
                    setToast({ message: `تم إنشاء فئة "${cat.name}"`, type: "success" });
                  });
                }
              }}
              placeholder="اسم الفئة..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              dir="rtl"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!newCatName.trim()) return;
                  const cat = await createCat.mutateAsync(newCatName.trim());
                  setActiveTab(`cat_${cat.id}`);
                  setShowNewCategory(false);
                  setNewCatName("");
                  setToast({ message: `تم إنشاء فئة "${cat.name}"`, type: "success" });
                }}
                disabled={!newCatName.trim() || createCat.isPending}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createCat.isPending ? "جاري..." : "إنشاء الفئة"}
              </button>
              <button onClick={() => { setShowNewCategory(false); setNewCatName(""); }}
                className="px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

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
        {activeTab === "photos" && (
          <PhotosTab projectId={id} setToast={setToast} />
        )}
        {/* Dynamic category tabs */}
        {activeTab.startsWith("cat_") && (() => {
          const catId = activeTab.slice(4);
          const cat = categories.find((c: SACategory) => c.id === catId);
          if (!cat) return <EmptyState icon="🗂️" title="الفئة غير موجودة" description="ربما تم حذفها" />;
          return (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="font-bold text-lg">🗂️ {cat.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">أرفق أي نوع من الملفات لهذه الفئة</p>
                </div>
                {canDelete && <button
                  onClick={() => setCategoryToDelete(cat)}
                  className="text-xs text-destructive hover:underline"
                >
                  🗑️ حذف الفئة
                </button>}
              </div>
              <AttachmentsPanel projectId={id} entityType="custom_doc" entityId={catId} />
            </div>
          );
        })()}
      </div>
      <ConfirmDialog
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={async () => {
          if (!categoryToDelete) return;
          const name = categoryToDelete.name;
          await removeCat.mutateAsync(categoryToDelete.id);
          setCategoryToDelete(null);
          setActiveTab("contracts");
          setToast({ message: `تم حذف فئة "${name}"`, type: "success" });
        }}
        title="حذف الفئة"
        message={`سيتم حذف فئة "${categoryToDelete?.name || ""}" وجميع ملفاتها نهائياً. هل تريد المتابعة؟`}
        confirmLabel="حذف"
        danger
        loading={removeCat.isPending}
      />
    </div>
  );
}

/* ===== CONTRACTS TAB ===== */
type ContractFormData = {
  title: string; party: string; value: string;
  startDate: string; endDate: string; status: ContractStatus; notes: string;
};
const defaultContractForm: ContractFormData = {
  title: "", party: "", value: "", startDate: "", endDate: "", status: "active", notes: ""
};

function ContractsTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, update, remove } = useContracts(projectId);
  const attachment = useAttachmentActions(projectId);
  const { canEdit, canDelete } = getArchivePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<{ id: string; data: ContractFormData } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractFormData>(defaultContractForm);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractFolder, setContractFolder] = useState<File[] | null>(null);
  const [contractZip, setContractZip] = useState<File | null>(null);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    try {
      const contract = await create.mutateAsync({ id: projectId, data: {
        ...form,
        party: form.party.trim() || "غير محدد",
        value: Number(form.value) || 0,
        startDate: form.startDate || new Date().toISOString().slice(0, 10),
        endDate: form.endDate || new Date().toISOString().slice(0, 10),
        notes: form.notes || null,
        fileUrl: null,
      } });
      if (contractFile) await attachment.add.mutateAsync({ entityType: "contract", entityId: contract.id, file: contractFile, name: contractFile.name, customType: "مرفق عقد" });
      await uploadPendingFolder(attachment, "contract", contract.id, contractFolder, contractZip, "مرفق عقد");
      setShowCreate(false); setForm(defaultContractForm); setContractFile(null); setContractFolder(null); setContractZip(null);
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
        {canEdit && <button onClick={() => { setForm(defaultContractForm); setShowCreate(true); }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          + إضافة عقد
        </button>}
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
              {(canEdit || canDelete) && <div className="flex gap-4 mt-3 text-sm">
                {canEdit &&
                <button onClick={() => setEditItem({ id: c.id, data: { title: c.title, party: c.party, value: c.value.toString(), startDate: c.startDate, endDate: c.endDate, status: c.status as ContractStatus, notes: c.notes ?? "" } })} className="text-primary hover:underline">تعديل</button>
                }
                {canDelete &&
                <button onClick={() => setDeleteId(c.id)} className="text-destructive hover:underline">حذف</button>
                }
              </div>
              }
              <AttachmentsPanel projectId={projectId} entityType="contract" entityId={c.id} compact />
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="إضافة عقد">
         <ContractForm data={form} onChange={setForm} onSubmit={handleCreate} loading={create.isPending || attachment.add.isPending || attachment.addFolderZip.isPending} submitLabel="إضافة العقد"
           file={contractFile} onFileChange={setContractFile} folderFiles={contractFolder} zipFile={contractZip} onFolderChange={setContractFolder} onZipChange={setContractZip} />
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

function ContractForm({ data, onChange, onSubmit, loading, submitLabel, file, onFileChange, folderFiles, zipFile, onFolderChange, onZipChange }: {
  data: ContractFormData; onChange: (d: ContractFormData) => void; onSubmit: () => void; loading: boolean; submitLabel: string;
  file?: File | null; onFileChange?: (file: File | null) => void; folderFiles?: File[] | null; zipFile?: File | null;
  onFolderChange?: (files: File[] | null) => void; onZipChange?: (file: File | null) => void;
}) {
  const set = (k: keyof ContractFormData, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <FormField label="عنوان العقد *"><input value={data.title} onChange={(e) => set("title", e.target.value)} placeholder="عنوان العقد" className={inputCls} dir="rtl" /></FormField>
       <FormField label="الطرف الآخر (اختياري)"><input value={data.party} onChange={(e) => set("party", e.target.value)} placeholder="اسم الشركة أو المقاول" className={inputCls} dir="rtl" /></FormField>
      <FormField label="قيمة العقد (ريال)"><input type="number" value={data.value} onChange={(e) => set("value", e.target.value)} placeholder="0" className={inputCls} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="تاريخ البداية"><input type="date" lang="en-GB" dir="rtl" value={data.startDate} onChange={(e) => set("startDate", e.target.value)} className={`${inputCls} archive-date-input`} /></FormField>
        <FormField label="تاريخ الانتهاء"><input type="date" lang="en-GB" dir="rtl" value={data.endDate} onChange={(e) => set("endDate", e.target.value)} className={`${inputCls} archive-date-input`} /></FormField>
      </div>
      <FormField label="الحالة">
        <select value={data.status} onChange={(e) => set("status", e.target.value)} className={inputCls} dir="rtl">
          {(["active","completed","pending","cancelled"] as ContractStatus[]).map((s) => <option key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</option>)}
        </select>
      </FormField>
      <FormField label="ملاحظات"><textarea value={data.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
      <FormField label="إرفاق ملف (اختياري)">
        <label className="block w-full py-3 border-2 border-dashed border-primary/30 rounded-xl text-center cursor-pointer hover:bg-primary/5 transition-colors text-sm text-muted-foreground">
          📎 أرفق أي ملف (PDF، Word، Excel، صورة...)
          <input type="file" className="hidden" onChange={(e) => {
             onFileChange?.(e.target.files?.[0] ?? null);
          }} />
        </label>
         {file && <p className="text-xs text-primary mt-1">✅ {file.name}</p>}
         {onFolderChange && onZipChange && <PendingFolderUpload folderFiles={folderFiles ?? null} zipFile={zipFile ?? null} onFolderChange={onFolderChange} onZipChange={onZipChange} />}
      </FormField>
      <button onClick={onSubmit} disabled={loading || !data.title.trim()} className={btnCls}>{loading ? "جاري..." : submitLabel}</button>
    </div>
  );
}

/* ===== CONTRACTORS TAB ===== */
type ContractorTabFormData = { name: string; specialty: string; phone: string; email: string; status: "active" | "inactive"; notes: string; };
const defaultContractorForm: ContractorTabFormData = { name: "", specialty: "", phone: "", email: "", status: "active", notes: "" };

function ContractorsTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, update, remove } = useProjectContractors(projectId);
  const attachment = useAttachmentActions(projectId);
  const { canEdit, canDelete } = getArchivePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<{ id: string; data: ContractorTabFormData } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractorTabFormData>(defaultContractorForm);
  const [contractorFolder, setContractorFolder] = useState<File[] | null>(null);
  const [contractorZip, setContractorZip] = useState<File | null>(null);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      const contractor = await create.mutateAsync({ id: projectId, data: { ...form, specialty: form.specialty.trim() || "غير محدد", phone: form.phone || null, email: form.email || null, notes: form.notes || null } });
      await uploadPendingFolder(attachment, "custom_doc", contractor.id, contractorFolder, contractorZip, "مرفق مقاول");
      setShowCreate(false); setForm(defaultContractorForm); setContractorFolder(null); setContractorZip(null);
      setToast({ message: "تم إضافة المقاول", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">المقاولون ({list.data?.length ?? 0})</h2>
        {canEdit && <button onClick={() => { setForm(defaultContractorForm); setShowCreate(true); }} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ إضافة مقاول</button>}
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
              {(canEdit || canDelete) && <div className="flex gap-4 mt-3 text-sm">
                {canEdit &&
                <button onClick={() => setEditItem({ id: c.id, data: { name: c.name, specialty: c.specialty, phone: c.phone ?? "", email: c.email ?? "", status: c.status as "active"|"inactive", notes: c.notes ?? "" } })} className="text-primary hover:underline">تعديل</button>
                }
                {canDelete &&
                <button onClick={() => setDeleteId(c.id)} className="text-destructive hover:underline">حذف</button>
                }
              </div>
              }
              <AttachmentsPanel projectId={projectId} entityType="custom_doc" entityId={c.id} compact />
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="إضافة مقاول">
         <ContractorForm data={form} onChange={setForm} onSubmit={handleCreate} loading={create.isPending || attachment.add.isPending || attachment.addFolderZip.isPending} submitLabel="إضافة المقاول"
           folderFiles={contractorFolder} zipFile={contractorZip} onFolderChange={setContractorFolder} onZipChange={setContractorZip} />
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

function ContractorForm({ data, onChange, onSubmit, loading, submitLabel, folderFiles, zipFile, onFolderChange, onZipChange }: {
  data: ContractorTabFormData; onChange: (d: ContractorTabFormData) => void; onSubmit: () => void; loading: boolean; submitLabel: string;
  folderFiles?: File[] | null; zipFile?: File | null; onFolderChange?: (files: File[] | null) => void; onZipChange?: (file: File | null) => void;
}) {
  const set = (k: keyof ContractorTabFormData, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <FormField label="الاسم *"><input value={data.name} onChange={(e) => set("name", e.target.value)} placeholder="اسم المقاول" className={inputCls} dir="rtl" /></FormField>
       <FormField label="التخصص (اختياري)"><input value={data.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="مهندس مدني، كهربائي..." className={inputCls} dir="rtl" /></FormField>
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
      {onFolderChange && onZipChange && <FormField label="مرفقات اختيارية"><PendingFolderUpload folderFiles={folderFiles ?? null} zipFile={zipFile ?? null} onFolderChange={onFolderChange} onZipChange={onZipChange} /></FormField>}
      <button onClick={onSubmit} disabled={loading || !data.name.trim()} className={btnCls}>{loading ? "جاري..." : submitLabel}</button>
    </div>
  );
}

/* ===== DOCUMENTS TAB ===== */
function DocumentsTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, remove } = useDocuments(projectId);
  const attachment = useAttachmentActions(projectId);
  const { canEdit, canDelete } = getArchivePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [docName, setDocName] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; filename: string; size: number; mimetype: string } | null>(null);
  const [documentFolder, setDocumentFolder] = useState<File[] | null>(null);
  const [documentZip, setDocumentZip] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getTypeFromMime = (mime: string): DocumentType => {
    if (mime === "application/pdf") return "pdf";
    if (mime.startsWith("image/")) return "image";
    if (mime.includes("word")) return "word";
    if (mime.includes("excel") || mime.includes("spreadsheet")) return "excel";
    return "other";
  };

  const handleCreate = async () => {
    if (!docName.trim()) return;
    try {
      const document = await create.mutateAsync({ id: projectId, data: {
        name: docName,
        type: getTypeFromMime(uploadedFile?.mimetype ?? ""),
        url: uploadedFile?.url ?? "",
        size: uploadedFile?.size ?? null,
        notes: docNotes || null,
      } });
      await uploadPendingFolder(attachment, "custom_doc", document.id, documentFolder, documentZip, "مرفق مخطط");
      setShowCreate(false); setDocName(""); setDocNotes(""); setUploadedFile(null); setDocumentFolder(null); setDocumentZip(null);
      setToast({ message: "تم إضافة المستند", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">المستندات ({list.data?.length ?? 0})</h2>
        {canEdit && <button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ رفع مستند</button>}
      </div>
      {list.isLoading ? <LoadingSkeleton /> : !list.data?.length ? (
        <EmptyState icon="📄" title="لا توجد مستندات" description="ارفع أول مستند لهذا المشروع" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.data.map((d) => (
            <div key={d.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-start gap-3">
              <span className="text-3xl mt-0.5">{DOCUMENT_TYPE_ICONS[d.type as DocumentType]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-sm truncate">{d.name}</h3>
                  {"docRef" in d && (d as { docRef?: string }).docRef && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">{(d as { docRef?: string }).docRef}</span>
                  )}
                </div>
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
                {canDelete && <button onClick={() => setDeleteId(d.id)} className="text-destructive hover:underline text-xs flex-shrink-0">حذف</button>}
                <AttachmentsPanel projectId={projectId} entityType="custom_doc" entityId={d.id} compact />
            </div>
          ))}
        </div>
      )}
      {canEdit && <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="إضافة مخطط">
        <div className="space-y-4">
          <FormField label="اسم المستند *">
            <input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="اسم المستند" className={inputCls} dir="rtl" />
          </FormField>
          <FileUpload projectId={projectId} section="documents" label="رفع الملف (اختياري)" onUpload={(f) => { setUploadedFile(f); if (!docName) setDocName(f.filename.replace(/^\d+-/, "")); }} />
          {uploadedFile && <p className="text-sm text-green-600">✅ تم رفع: {uploadedFile.filename}</p>}
          <PendingFolderUpload folderFiles={documentFolder} zipFile={documentZip} onFolderChange={setDocumentFolder} onZipChange={setDocumentZip} />
          <FormField label="ملاحظات"><textarea value={docNotes} onChange={(e) => setDocNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
          <button onClick={handleCreate} disabled={create.isPending || attachment.add.isPending || attachment.addFolderZip.isPending || !docName.trim()} className={btnCls}>{create.isPending || attachment.add.isPending || attachment.addFolderZip.isPending ? "جاري..." : "إضافة المخطط"}</button>
        </div>
      </Modal>}
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove.mutateAsync({ id: projectId, did: deleteId! }); setDeleteId(null); setToast({ message: "تم حذف المستند", type: "success" }); }} title="حذف المستند" message="هل أنت متأكد من حذف هذا المستند؟" confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

/* ===== MEETINGS TAB ===== */
type MeetingFormData = { title: string; date: string; location: string; agenda: string; notes: string; attendees: string[]; };
const defaultMeetingForm: MeetingFormData = { title: "", date: "", location: "", agenda: "", notes: "", attendees: [] };

function MeetingsTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, update, remove } = useMeetings(projectId);
  const { canEdit, canDelete } = getArchivePermissions();
  const attachment = useAttachmentActions(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [form, setForm] = useState<MeetingFormData>(defaultMeetingForm);
  const [meetingFile, setMeetingFile] = useState<File | null>(null);
  const [meetingFolder, setMeetingFolder] = useState<File[] | null>(null);
  const [meetingZip, setMeetingZip] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [attendeeInput, setAttendeeInput] = useState("");

  const addAttendee = () => {
    const name = attendeeInput.trim();
    if (name && !form.attendees.includes(name)) {
      setForm({ ...form, attendees: [...form.attendees, name] });
      setAttendeeInput("");
    }
  };

  const openCreate = () => {
    setEditingMeetingId(null);
    setForm(defaultMeetingForm);
    setMeetingFile(null);
    setMeetingFolder(null);
    setMeetingZip(null);
    setAttendeeInput("");
    setShowCreate(true);
  };

  const openEdit = (meeting: {
    id: string;
    title: string;
    date: string;
    location?: string | null;
    agenda?: string | null;
    notes?: string | null;
    attendees: string[];
  }) => {
    setEditingMeetingId(meeting.id);
    setForm({
      title: meeting.title,
      date: meeting.date,
      location: meeting.location ?? "",
      agenda: meeting.agenda ?? "",
      notes: meeting.notes ?? "",
      attendees: [...meeting.attendees],
    });
    setMeetingFile(null);
    setMeetingFolder(null);
    setMeetingZip(null);
    setAttendeeInput("");
    setShowCreate(false);
  };

  const closeForm = () => {
    setShowCreate(false);
    setEditingMeetingId(null);
    setForm(defaultMeetingForm);
    setMeetingFile(null);
    setAttendeeInput("");
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
       const data = { ...form, date: form.date || new Date().toISOString().slice(0, 10), location: form.location || null, agenda: form.agenda || null, notes: form.notes || null };
      const meeting = editingMeetingId
        ? await update.mutateAsync({ id: projectId, mid: editingMeetingId, data })
        : await create.mutateAsync({ id: projectId, data });
      if (meetingFile) {
        await attachment.add.mutateAsync({
          entityType: "meeting",
          entityId: meeting.id,
          file: meetingFile,
          name: meetingFile.name,
          customType: "مرفق اجتماع",
        });
      }
      await uploadPendingFolder(attachment, "meeting", meeting.id, meetingFolder, meetingZip, "مرفق اجتماع");
      closeForm();
      setToast({ message: editingMeetingId ? "تم تحديث الاجتماع" : "تم إضافة الاجتماع", type: "success" });
    } catch { setToast({ message: editingMeetingId ? "فشل في التحديث" : "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">الاجتماعات ({list.data?.length ?? 0})</h2>
        {canEdit && <button onClick={openCreate} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ إضافة اجتماع</button>}
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
              {(canEdit || canDelete) && <div className="flex items-center gap-4 mt-3 text-sm">
                {canEdit && <button onClick={() => openEdit(m)} className="text-primary hover:underline">تعديل</button>}
                {canDelete && <button onClick={() => setDeleteId(m.id)} className="text-destructive hover:underline">حذف</button>}
              </div>}
              <AttachmentsPanel projectId={projectId} entityType="meeting" entityId={m.id} compact />
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreate || !!editingMeetingId} onClose={closeForm} title={editingMeetingId ? "تعديل الاجتماع" : "إضافة اجتماع"} size="lg">
        <div className="space-y-3">
          <FormField label="عنوان الاجتماع *"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان الاجتماع" className={inputCls} dir="rtl" /></FormField>
          <div className="grid grid-cols-2 gap-3">
             <FormField label="التاريخ (اختياري)"><input type="date" lang="en-GB" dir="rtl" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${inputCls} text-right archive-date-input`} style={{ direction: "rtl", textAlign: "right" }} /></FormField>
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
          <FormField label="الأجندة"><textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={2} placeholder="اكتب محاور ونقاط الاجتماع الرئيسية هنا" className={`${inputCls} resize-none`} dir="rtl" /></FormField>
          <FormField label="ملاحظات"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={`${inputCls} resize-none`} dir="rtl" /></FormField>
           <FormField label="مرفقات اختيارية">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => setMeetingFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-muted-foreground file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary" />
            <p className="text-xs text-muted-foreground mt-1">PDF أو صورة أو مستند Word</p>
             <PendingFolderUpload folderFiles={meetingFolder} zipFile={meetingZip} onFolderChange={setMeetingFolder} onZipChange={setMeetingZip} />
          </FormField>
           <button onClick={handleSave} disabled={create.isPending || update.isPending || attachment.add.isPending || attachment.addFolderZip.isPending || !form.title.trim()} className={btnCls}>{create.isPending || update.isPending || attachment.add.isPending || attachment.addFolderZip.isPending ? "جاري..." : editingMeetingId ? "حفظ التعديلات" : "إضافة الاجتماع"}</button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove.mutateAsync({ id: projectId, mid: deleteId! }); setDeleteId(null); setToast({ message: "تم حذف الاجتماع", type: "success" }); }} title="حذف الاجتماع" message="هل أنت متأكد؟" confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

/* ===== LETTERS TAB ===== */
type LetterFormData = { subject: string; direction: LetterDirection; from: string; to: string; date: string; reference: string; notes: string; distributionStatus?: string; recipients?: string[]; };
const defaultLetterForm: LetterFormData = { subject: "", direction: "outgoing", from: "", to: "", date: "", reference: "", notes: "", distributionStatus: "not_sent", recipients: [] };

function LettersTab({ projectId, setToast }: { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void }) {
  const { list, create, remove } = useLetters(projectId);
  const { canEdit, canDelete } = getArchivePermissions();
  const attachment = useAttachmentActions(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<LetterFormData>(defaultLetterForm);
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const [letterFolder, setLetterFolder] = useState<File[] | null>(null);
  const [letterZip, setLetterZip] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.subject.trim()) return;
    try {
      const letter = await create.mutateAsync({ id: projectId, data: {
        ...form,
        from: form.from.trim() || "غير محدد",
        to: form.to.trim() || "غير محدد",
        date: form.date || new Date().toISOString().slice(0, 10),
        reference: form.reference || null,
        notes: form.notes || null,
        fileUrl: null,
      } });
      if (letterFile) {
        await attachment.add.mutateAsync({
          entityType: "letter",
          entityId: letter.id,
          file: letterFile,
          name: letterFile.name,
          customType: "مرفق خطاب",
        });
      }
      await uploadPendingFolder(attachment, "letter", letter.id, letterFolder, letterZip, "مرفق خطاب");
      setShowCreate(false); setForm(defaultLetterForm); setLetterFile(null); setLetterFolder(null); setLetterZip(null);
      setToast({ message: "تم إضافة الخطاب", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">الخطابات ({list.data?.length ?? 0})</h2>
        {canEdit && <button onClick={() => { setForm(defaultLetterForm); setShowCreate(true); }} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ إضافة خطاب</button>}
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
              {canDelete && <button onClick={() => setDeleteId(l.id)} className="text-destructive hover:underline text-sm mt-3">حذف</button>}
              <AttachmentsPanel projectId={projectId} entityType="letter" entityId={l.id} compact />
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
             <FormField label="من (اختياري)"><input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="المرسل" className={inputCls} dir="rtl" /></FormField>
             <FormField label="إلى (اختياري)"><input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="المستلم" className={inputCls} dir="rtl" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <FormField label="التاريخ (اختياري)"><input type="date" lang="en-GB" dir="rtl" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${inputCls} archive-date-input`} /></FormField>
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
              {(["owner","consultant","contractor","technical_office","other"] as const).map((r) => {
                const labels: Record<string, string> = { owner: "مالك", consultant: "استشاري", contractor: "مقاول", technical_office: "مكتب فني", other: "أخرى" };
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
           <FormField label="مرفقات اختيارية">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => setLetterFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-muted-foreground file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary" />
            <p className="text-xs text-muted-foreground mt-1">PDF أو صورة أو مستند Word</p>
             <PendingFolderUpload folderFiles={letterFolder} zipFile={letterZip} onFolderChange={setLetterFolder} onZipChange={setLetterZip} />
          </FormField>
          <p className="text-xs text-muted-foreground">سيتم توليد رقم مرجعي تلقائي (LTR-XXXX-XXX) عند الحفظ</p>
           <button onClick={handleCreate} disabled={create.isPending || attachment.add.isPending || attachment.addFolderZip.isPending || !form.subject.trim()} className={btnCls}>{create.isPending || attachment.add.isPending || attachment.addFolderZip.isPending ? "جاري..." : "إضافة الخطاب"}</button>
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
  const attachment = useAttachmentActions(projectId);
  const { canEdit, canDelete } = getArchivePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", role: "consultant", phone: "", email: "", notes: "" });
  const [contactFolder, setContactFolder] = useState<File[] | null>(null);
  const [contactZip, setContactZip] = useState<File | null>(null);

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
      const contact = await create.mutateAsync({ name: form.name, role: form.role as "owner" | "consultant" | "contractor" | "technical_office" | "other", phone: form.phone || null, email: form.email || null, notes: form.notes || null });
      await uploadPendingFolder(attachment, "custom_doc", contact.id, contactFolder, contactZip, "مرفق جهة اتصال");
      setShowCreate(false);
      setForm({ name: "", role: "consultant", phone: "", email: "", notes: "" });
      setContactFolder(null);
      setContactZip(null);
      setToast({ message: "تم إضافة جهة الاتصال", type: "success" });
    } catch { setToast({ message: "فشل في الإضافة", type: "error" }); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">جهات الاتصال ({data?.length ?? 0})</h2>
        {canEdit && <button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">+ إضافة جهة</button>}
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
              {canDelete && <button onClick={() => setDeleteId(c.id)} className="text-destructive hover:underline text-sm mt-3">حذف</button>}
              <AttachmentsPanel projectId={projectId} entityType="custom_doc" entityId={c.id} compact />
            </div>
          ))}
        </div>
      )}
      {canEdit && <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="إضافة جهة اتصال">
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
          <FormField label="مرفقات اختيارية"><PendingFolderUpload folderFiles={contactFolder} zipFile={contactZip} onFolderChange={setContactFolder} onZipChange={setContactZip} /></FormField>
          <button onClick={handleCreate} disabled={create.isPending || attachment.add.isPending || attachment.addFolderZip.isPending || !form.name.trim()} className={btnCls}>{create.isPending || attachment.add.isPending || attachment.addFolderZip.isPending ? "جاري..." : "إضافة الجهة"}</button>
        </div>
      </Modal>}
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove.mutateAsync(deleteId!); setDeleteId(null); setToast({ message: "تم حذف جهة الاتصال", type: "success" }); }} title="حذف جهة الاتصال" message="هل أنت متأكد؟" confirmLabel="حذف" danger loading={remove.isPending} />
    </div>
  );
}

/* ===== PHOTOS TAB ===== */
function PhotosTab({ projectId, setToast }: TabProps) {
  const { data: photos = [], isLoading } = useProjectPhotos(projectId);
  const { add, remove } = usePhotoActions(projectId);
  const { canEdit, canDelete } = getArchivePermissions();
  const [preview, setPreview] = useState<SAPhoto | null>(null);
  const [desc, setDesc] = useState("");
  const inputRef = useState<HTMLInputElement | null>(null);

  const handleFiles = (files: File[] | null) => {
    if (!files) return;
    files.forEach(file => {
      if (!file.type.startsWith("image/")) return;
      void add.mutateAsync({ file, name: file.name, description: desc }).then(() => {
        setToast({ message: "تم رفع الصورة", type: "success" });
      }).catch(() => {
        setToast({ message: "فشل رفع الصورة", type: "error" });
      });
    });
    setDesc("");
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    setToast({ message: "تم حذف الصورة", type: "success" });
    if (preview?.id === id) setPreview(null);
  };

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      {canEdit && <div
        className="relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all hover:opacity-90"
        style={{ borderColor: "rgba(0,240,255,0.30)", background: "rgba(0,240,255,0.03)" }}
        onClick={() => document.getElementById("photo-upload-input")?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)); }}
      >
        <div className="text-4xl mb-2">🖼️</div>
        <p className="text-sm font-semibold" style={{ color: "#00f0ff" }}>اسحب الصور هنا أو انقر للاختيار</p>
        <p className="text-xs text-muted-foreground mt-1">يدعم JPG، PNG، WEBP — يمكن اختيار عدة صور</p>
        <input
          id="photo-upload-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
           onChange={e => handleFiles(e.target.files ? Array.from(e.target.files) : null)}
        />
        <FolderPicker
          accept="image/*"
          label="📂 رفع مجلد صور كامل"
          onFiles={handleFiles}
          className="inline-block mt-3 text-xs text-primary cursor-pointer hover:underline"
        />
      </div>}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="aspect-square rounded-xl animate-pulse bg-muted" />)}
        </div>
      ) : photos.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-5xl mb-3">📷</div>
          <p className="text-sm font-semibold text-foreground">لا توجد صور بعد</p>
          <p className="text-xs text-muted-foreground mt-1">ارفع أولى صور المشروع من المنطقة أعلاه</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map(photo => (
            <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden cursor-pointer"
              style={{ border: "1px solid rgba(0,240,255,0.12)" }}
              onClick={() => setPreview(photo)}>
              <img src={photo.dataUrl} alt={photo.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.70) 0%, transparent 50%)" }}>
                {canDelete && <button
                  className="self-end w-7 h-7 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ background: "rgba(255,0,80,0.80)" }}
                  onClick={e => { e.stopPropagation(); handleDelete(photo.id); }}>
                  ✕
                </button>}
                <p className="text-white text-[11px] font-medium truncate">{photo.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
          onClick={() => setPreview(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={preview.dataUrl} alt={preview.name}
              className="w-full max-h-[80vh] object-contain rounded-2xl" />
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-sm">{preview.name}</p>
                {preview.description && <p className="text-gray-400 text-xs mt-0.5">{preview.description}</p>}
                <p className="text-gray-500 text-xs mt-0.5">{new Date(preview.uploadedAt).toLocaleDateString("ar-SA")}</p>
              </div>
              <div className="flex gap-2">
                <a href={preview.dataUrl} download={preview.name}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                  style={{ background: "rgba(0,240,255,0.20)", border: "1px solid rgba(0,240,255,0.30)" }}>
                  تنزيل
                </a>
                {canDelete && <button onClick={() => handleDelete(preview.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                  style={{ background: "rgba(255,0,80,0.20)", border: "1px solid rgba(255,0,80,0.30)" }}>
                  حذف
                </button>}
                <button onClick={() => setPreview(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                  style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== ATTACHMENTS PANEL ===== */
// Shared panel — appears inside each contract / meeting / letter card AND in the "مستندات أخرى" tab
type TabProps = { projectId: string; setToast: (t: { message: string; type: "success" | "error" } | null) => void };

function AttachmentsPanel({
  projectId,
  entityType,
  entityId,
  compact = false,
}: {
  projectId: string;
  entityType: "contract" | "meeting" | "letter" | "custom_doc";
  entityId: string;
  compact?: boolean;
}) {
  const { data: attachments = [], isLoading } = useEntityAttachments(projectId, entityType, entityId);
  const { add, addFolderZip, remove, removeFolder } = useAttachmentActions(projectId);
  const { canEdit, canDelete } = getArchivePermissions();
  const [showAdd, setShowAdd] = useState(false);
  const [attName, setAttName] = useState("");
  const [attType, setAttType] = useState("مستند");
  const [currentPath, setCurrentPath] = useState("");
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [preview, setPreview] = useState<SAAttachment | null>(null);

  const uploadFiles = async (files: File[] | null, preserveFolders = false) => {
    if (!files?.length) return;
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (files.length > 10000 || files.some((file) => file.size > 500 * 1024 * 1024) || totalBytes > 5 * 1024 * 1024 * 1024) {
      setNotice({ message: "المجلد يجب ألا يتجاوز 10000 ملف أو 5GB، وألا يتجاوز أي ملف 500MB", type: "error" });
      return;
    }
    try {
      for (const file of files) {
        const selectedPath = preserveFolders ? file.webkitRelativePath || file.name : file.name;
        const relativePath = [currentPath, selectedPath].filter(Boolean).join("/");
        await add.mutateAsync({
          entityType,
          entityId,
          file,
          name: files.length === 1 && attName && !currentPath ? attName : relativePath,
          customType: attType,
          relativePath,
        });
      }
      setShowAdd(false);
      setAttName("");
      setAttType("مستند");
    } catch {
      setNotice({ message: "تعذر رفع بعض ملفات المجلد", type: "error" });
    }
  };

  const uploadFolderZip = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) {
      setNotice({ message: "ملف ZIP يجب ألا يتجاوز 1GB؛ أما محتواه بعد الفك فيسمح حتى 5GB", type: "error" });
      return;
    }
    try {
      const uploaded = await addFolderZip.mutateAsync({ entityType, entityId, file, customType: attType, targetPath: currentPath });
      setNotice({ message: `تم رفع المجلد وحفظ ${uploaded.length} ملفاً في هذا القسم`, type: "success" });
      setShowAdd(false);
    } catch {
      setNotice({ message: "تعذر فتح ZIP. تأكد أنه صالح ولا يتجاوز 10000 ملف أو 5GB بعد فك الضغط", type: "error" });
    }
  };

  const mimeIcon = (mime: string) => {
    if (mime.startsWith("image/")) return "🖼️";
    if (mime === "application/pdf") return "📕";
    if (mime.includes("word")) return "📝";
    if (mime.includes("excel") || mime.includes("spreadsheet")) return "📊";
    if (mime.includes("powerpoint") || mime.includes("presentation")) return "📋";
    if (mime.startsWith("text/")) return "📄";
    return "📎";
  };

  return (
    <div className={compact ? "mt-3 border-t border-border pt-3" : "mt-4"}>
      {notice && <Toast message={notice.message} type={notice.type} onClose={() => setNotice(null)} />}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">
          📎 المرفقات ({isLoading ? "…" : attachments.length})
        </span>
        {canEdit && <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs text-primary hover:underline"
        >
          {showAdd ? "إلغاء" : "+ إرفاق ملف"}
        </button>}
      </div>

      {canEdit && showAdd && (
        <div className="bg-muted/40 rounded-xl p-3 mb-2 space-y-2">
          <input
            value={attName}
            onChange={(e) => setAttName(e.target.value)}
            placeholder="اسم المستند (اختياري)"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
            dir="rtl"
          />
          <input
            value={attType}
            onChange={(e) => setAttType(e.target.value)}
            placeholder="نوع / تصنيف (مثال: تقرير، ضمان، فاتورة...)"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
            dir="rtl"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="block w-full px-3 py-2.5 rounded-lg border border-dashed border-primary/40 text-xs text-center cursor-pointer hover:bg-primary/5 transition-colors">
              📄 اختر ملفات
              <input type="file" multiple className="hidden" onChange={(e) => void uploadFiles(e.target.files ? Array.from(e.target.files) : null)} />
            </label>
            <FolderPicker
              label="📂 اختر مجلداً كاملاً"
              onFiles={(files) => void uploadFiles(files, true)}
              className="block w-full px-3 py-2.5 rounded-lg border border-dashed border-primary/40 text-xs text-center cursor-pointer hover:bg-primary/5 transition-colors"
            />
            <label className="block w-full px-3 py-2.5 rounded-lg border border-dashed border-primary/40 text-xs text-center cursor-pointer hover:bg-primary/5 transition-colors">
              🗜️ رفع مجلد ZIP للجوال
              <input type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => void uploadFolderZip(e.target.files?.[0])} />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">مكان الحفظ: {currentPath || "جذر قسم المرفقات الحالي"} — مع الاحتفاظ بجميع المجلدات الفرعية.</p>
        </div>
      )}

      {attachments.length > 0 && <AttachmentFolderBrowser
        attachments={attachments}
        currentPath={currentPath}
        onPathChange={setCurrentPath}
        canDelete={canDelete}
        onDelete={(att) => remove.mutateAsync({ aid: att.id, entityType, entityId })}
        onDeleteFolder={(folderPath) => removeFolder.mutateAsync({ entityType, entityId, folderPath })}
        onPreview={setPreview}
        mimeIcon={mimeIcon}
        compact
      />}
      <AttachmentPreview attachment={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/* ===== CUSTOM DOCS TAB ===== */
function CustomDocsTab({ projectId, setToast: _setToast }: TabProps) {
  const { data: docs = [], isLoading } = useEntityAttachments(projectId, "custom_doc", projectId);
  const { add, addFolderZip, remove, removeFolder } = useAttachmentActions(projectId);
  const { canEdit, canDelete } = getArchivePermissions();
  const [showAdd, setShowAdd] = useState(false);
  const [attName, setAttName] = useState("");
  const [attType, setAttType] = useState("");
  const [search, setSearch] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [preview, setPreview] = useState<SAAttachment | null>(null);

  const uploadFiles = async (files: File[] | null, preserveFolders = false) => {
    if (!files?.length) return;
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (files.length > 10000 || files.some((file) => file.size > 500 * 1024 * 1024) || totalBytes > 5 * 1024 * 1024 * 1024) {
      _setToast({ message: "المجلد يجب ألا يتجاوز 10000 ملف أو 5GB، وألا يتجاوز أي ملف 500MB", type: "error" });
      return;
    }
    try {
      for (const file of files) {
        const selectedPath = preserveFolders ? file.webkitRelativePath || file.name : file.name;
        const relativePath = [currentPath, selectedPath].filter(Boolean).join("/");
        await add.mutateAsync({
          entityType: "custom_doc",
          entityId: projectId,
          file,
          name: files.length === 1 && attName.trim() && !currentPath ? attName : relativePath,
          customType: attType || "مستند حر",
          relativePath,
        });
      }
      setShowAdd(false);
      setAttName("");
      setAttType("");
      _setToast({ message: files.length > 1 ? `تم رفع ${files.length} ملفاً` : "تم إضافة المستند", type: "success" });
    } catch {
      _setToast({ message: "تعذر رفع بعض ملفات المجلد", type: "error" });
    }
  };

  const uploadFolderZip = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) {
      _setToast({ message: "ملف ZIP يجب ألا يتجاوز 1GB؛ أما محتواه بعد الفك فيسمح حتى 5GB", type: "error" });
      return;
    }
    try {
      const uploaded = await addFolderZip.mutateAsync({
        entityType: "custom_doc",
        entityId: projectId,
        file,
        customType: attType || "مجلد مستندات",
        targetPath: currentPath,
      });
      setShowAdd(false);
      _setToast({ message: `تم رفع المجلد وحفظ ${uploaded.length} ملفاً`, type: "success" });
    } catch {
      _setToast({ message: "تعذر فتح ZIP أو تجاوز المجلد الحدود المسموحة", type: "error" });
    }
  };

  const filtered = search
    ? docs.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.customType.toLowerCase().includes(search.toLowerCase())
      )
    : docs;

  const mimeIcon = (mime: string) => {
    if (mime.startsWith("image/")) return "🖼️";
    if (mime === "application/pdf") return "📕";
    if (mime.includes("word")) return "📝";
    if (mime.includes("excel") || mime.includes("spreadsheet")) return "📊";
    if (mime.includes("powerpoint") || mime.includes("presentation")) return "📋";
    if (mime.startsWith("text/")) return "📄";
    return "📎";
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">مستندات أخرى ({docs.length})</h2>
        {canEdit && <button
          onClick={() => setShowAdd(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + إضافة مستند
        </button>}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 بحث في المستندات..."
        className="w-full px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm mb-4"
        dir="rtl"
      />

      {isLoading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title={search ? "لا نتائج" : "لا توجد مستندات"}
          description={search ? "جرّب كلمة بحث أخرى" : "أضف أي مستند بأي نوع واسمّه كما تشاء"}
        />
      ) : (
        search ? <div className="space-y-2">
          {filtered.map((d) => <AttachmentFileRow key={d.id} attachment={d} canDelete={canDelete} onPreview={setPreview} mimeIcon={mimeIcon}
            onDelete={async (att) => {
              await remove.mutateAsync({ aid: att.id, entityType: "custom_doc", entityId: projectId });
              _setToast({ message: "تم حذف المستند", type: "success" });
            }} />)}
        </div> : <AttachmentFolderBrowser
          attachments={docs}
          currentPath={currentPath}
          onPathChange={setCurrentPath}
          canDelete={canDelete}
           onPreview={setPreview}
           onDeleteFolder={(folderPath) => removeFolder.mutateAsync({ entityType: "custom_doc", entityId: projectId, folderPath })}
          onDelete={async (att) => {
            await remove.mutateAsync({ aid: att.id, entityType: "custom_doc", entityId: projectId });
            _setToast({ message: "تم حذف المستند", type: "success" });
          }}
          mimeIcon={mimeIcon}
        />
      )}
      <AttachmentPreview attachment={preview} onClose={() => setPreview(null)} />

      {/* Add Modal */}
      {canEdit && showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowAdd(false)}>
          <div
            className="bg-card rounded-2xl border border-border p-6 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg">إضافة مستند حر</h3>
            <div>
              <label className="block text-sm font-medium mb-1.5">اسم المستند *</label>
              <input
                value={attName}
                onChange={(e) => setAttName(e.target.value)}
                placeholder="مثال: ضمان بنكي، رخصة بناء، شهادة جودة..."
                className={inputCls}
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">التصنيف / النوع</label>
              <input
                value={attType}
                onChange={(e) => setAttType(e.target.value)}
                placeholder="مثال: ضمان، ترخيص، تقرير، عرض سعر..."
                className={inputCls}
                dir="rtl"
              />
            </div>
            <div>
             <label className="block text-sm font-medium mb-1.5">الملف (اختياري)</label>
              <label className="block text-center py-4 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                <span className="text-3xl block mb-1">📂</span>
                <span className="text-sm text-muted-foreground">اختر ملفاً أو عدة ملفات</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void uploadFiles(e.target.files ? Array.from(e.target.files) : null)}
                />
              </label>
              <FolderPicker
                label="📁 اختر مجلداً كاملاً مع مجلداته الفرعية"
                onFiles={(files) => void uploadFiles(files, true)}
                className="block text-center py-3 mt-2 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 transition-colors"
              />
              <label className="block text-center py-3 mt-2 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                <span className="text-sm text-muted-foreground">🗜️ رفع المجلد كـ ZIP — يعمل على الجوال ونسخة PWA</span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => void uploadFolderZip(e.target.files?.[0])}
                />
              </label>
              <p className="text-xs text-muted-foreground mt-2">مكان الحفظ: {currentPath || "جذر مستندات المشروع"} — تحت التصنيف المكتوب أعلاه.</p>
            </div>
            <button onClick={() => setShowAdd(false)} className="w-full py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentFileRow({
  attachment,
  canDelete,
  onDelete,
  onPreview,
  mimeIcon,
  compact = false,
}: {
  attachment: SAAttachment;
  canDelete: boolean;
  onDelete: (attachment: SAAttachment) => void | Promise<unknown>;
  onPreview?: (attachment: SAAttachment) => void;
  mimeIcon: (mime: string) => string;
  compact?: boolean;
}) {
  const fileName = attachment.name.split("/").filter(Boolean).pop() || attachment.name;
  return (
    <div
      className={`flex items-center gap-3 bg-card border border-border shadow-sm ${compact ? "rounded-lg px-2 py-1.5 text-xs" : "rounded-2xl p-4"} ${onPreview ? "cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors" : ""}`}
      role={onPreview ? "button" : undefined}
      tabIndex={onPreview ? 0 : undefined}
      onClick={() => onPreview?.(attachment)}
      onKeyDown={(event) => {
        if (onPreview && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onPreview(attachment);
        }
      }}
    >
      <span className={compact ? "text-base" : "text-3xl"}>{mimeIcon(attachment.mimeType)}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{fileName}</p>
        <span className="text-muted-foreground text-xs">{attachment.customType}</span>
        {!compact && <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(attachment.uploadedAt).toLocaleDateString("ar-SA")}
          {attachment.size ? ` · ${(attachment.size / 1024).toFixed(0)} KB` : ""}
        </p>}
      </div>
      <a href={attachment.dataUrl} download={fileName} onClick={(event) => event.stopPropagation()} className="text-xs text-primary hover:underline shrink-0">تنزيل</a>
      {canDelete && <button onClick={(event) => { event.stopPropagation(); void onDelete(attachment); }} className="text-xs text-destructive hover:underline shrink-0">حذف</button>}
    </div>
  );
}

function AttachmentFolderBrowser({
  attachments,
  currentPath,
  onPathChange,
  canDelete,
  onDelete,
  onDeleteFolder,
  onPreview,
  mimeIcon,
  compact = false,
}: {
  attachments: SAAttachment[];
  currentPath: string;
  onPathChange: (path: string) => void;
  canDelete: boolean;
  onDelete: (attachment: SAAttachment) => void | Promise<unknown>;
  onDeleteFolder?: (folderPath: string) => void | Promise<unknown>;
  onPreview?: (attachment: SAAttachment) => void;
  mimeIcon: (mime: string) => string;
  compact?: boolean;
}) {
  const prefix = currentPath ? `${currentPath}/` : "";
  const children = attachments.filter((att) => att.name.startsWith(prefix));
  const folders = new Map<string, number>();
  const files: SAAttachment[] = [];
  for (const attachment of children) {
    const remainder = attachment.name.slice(prefix.length);
    const slash = remainder.indexOf("/");
    if (slash >= 0) {
      const folder = remainder.slice(0, slash);
      folders.set(folder, (folders.get(folder) || 0) + 1);
    } else {
      files.push(attachment);
    }
  }
  const pathParts = currentPath.split("/").filter(Boolean);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const folderDisplayName = folderToDelete?.split("/").filter(Boolean).pop() || "";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" dir="rtl">
        <button onClick={() => onPathChange("")} className="text-primary hover:underline">الرئيسية</button>
        {pathParts.map((part, index) => {
          const path = pathParts.slice(0, index + 1).join("/");
          return <span key={path} className="flex items-center gap-1"><span>/</span><button onClick={() => onPathChange(path)} className="text-primary hover:underline">{part}</button></span>;
        })}
      </div>
      {[...folders.entries()].sort(([a], [b]) => a.localeCompare(b, "ar")).map(([folder, count]) => (
        <div
          key={folder}
          className={`w-full flex items-center gap-2 bg-primary/5 border border-primary/20 text-right hover:bg-primary/10 transition-colors ${compact ? "rounded-lg px-2 py-2" : "rounded-2xl p-4"}`}
        >
          <button
            type="button"
            onClick={() => onPathChange([currentPath, folder].filter(Boolean).join("/"))}
            className="flex items-center gap-3 flex-1 min-w-0 text-right"
          >
            <span className={compact ? "text-xl" : "text-3xl"}>📁</span>
            <span className="flex-1 min-w-0 font-semibold truncate">{folder}</span>
            <span className="text-xs text-muted-foreground">{count} ملف</span>
            <span className="text-primary">‹</span>
          </button>
          {canDelete && onDeleteFolder && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setFolderToDelete([currentPath, folder].filter(Boolean).join("/"));
              }}
              className="text-xs text-destructive hover:underline shrink-0 px-1"
              title="حذف المجلد ومحتوياته"
            >
              حذف المجلد
            </button>
          )}
        </div>
      ))}
      {files.sort((a, b) => a.name.localeCompare(b.name, "ar")).map((attachment) => (
        <AttachmentFileRow key={attachment.id} attachment={attachment} canDelete={canDelete} onDelete={onDelete} onPreview={onPreview} mimeIcon={mimeIcon} compact={compact} />
      ))}
      {!folders.size && !files.length && <p className="text-xs text-muted-foreground text-center py-4">هذا المجلد فارغ</p>}
      {onDeleteFolder && (
        <ConfirmDialog
          isOpen={!!folderToDelete}
          onClose={() => setFolderToDelete(null)}
          onConfirm={async () => {
            if (!folderToDelete) return;
            setDeletingFolder(true);
            try {
              await onDeleteFolder(folderToDelete);
              if (currentPath === folderToDelete || currentPath.startsWith(`${folderToDelete}/`)) onPathChange("");
              setFolderToDelete(null);
            } finally {
              setDeletingFolder(false);
            }
          }}
          title="حذف المجلد"
          message={`سيتم حذف المجلد "${folderDisplayName}" وكل الملفات والمجلدات الموجودة بداخله نهائياً. هل تريد المتابعة؟`}
          confirmLabel="حذف المجلد"
          danger
          loading={deletingFolder}
        />
      )}
    </div>
  );
}

function AttachmentPreview({ attachment, onClose }: { attachment: SAAttachment | null; onClose: () => void }) {
  if (!attachment) return null;
  const fileName = attachment.name.split("/").filter(Boolean).pop() || attachment.name;
  const declaredMime = attachment.mimeType || "application/octet-stream";
  const extensionMime: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    pdf: "application/pdf", txt: "text/plain", csv: "text/csv", json: "application/json",
    mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav",
  };
  const extension = fileName.toLowerCase().split(".").pop() || "";
  const mime = declaredMime !== "application/octet-stream"
    ? declaredMime
    : extensionMime[extension] || declaredMime;
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const isText = mime.startsWith("text/") || mime === "application/json";
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border" dir="rtl">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{fileName}</h3>
            <p className="text-xs text-muted-foreground">انقر خارج النافذة للإغلاق</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted">إغلاق</button>
        </div>
        <div className="p-4 overflow-auto min-h-[220px] flex items-center justify-center bg-black/5">
          {isImage && <img src={attachment.dataUrl} alt={fileName} className="max-w-full max-h-[70vh] object-contain rounded-lg" />}
          {isPdf && <iframe src={attachment.dataUrl} title={fileName} className="w-full h-[70vh] rounded-lg bg-white" />}
          {isText && <iframe src={attachment.dataUrl} title={fileName} className="w-full h-[70vh] rounded-lg bg-white" />}
          {isVideo && <video src={attachment.dataUrl} controls className="max-w-full max-h-[70vh] rounded-lg" />}
          {isAudio && <audio src={attachment.dataUrl} controls />}
          {!isImage && !isPdf && !isText && !isVideo && !isAudio && (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">هذا النوع لا يعرض داخل المتصفح، ويمكن فتحه أو تنزيله.</p>
              <a href={attachment.dataUrl} target="_blank" rel="noreferrer" className="inline-block px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm">فتح الملف</a>
            </div>
          )}
        </div>
      </div>
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
