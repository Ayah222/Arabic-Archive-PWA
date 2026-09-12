import { useState } from "react";
import { Link } from "react-router-dom";
import { useAgencies, useAgencyActions, type AgencyRecord } from "../../controllers/useGlobal";
import { getArchivePermissions } from "../../controllers/permissions";
import Toast from "../components/shared/Toast";

type FormState = {
  clientName: string;
  authorizationNumber: string;
  expiresOn: string;
  file: File | null;
};

const emptyForm: FormState = { clientName: "", authorizationNumber: "", expiresOn: "", file: null };

function AgencyForm({ projectId, agency, onDone }: { projectId?: string; agency?: AgencyRecord; onDone: () => void }) {
  const [form, setForm] = useState<FormState>({
    clientName: agency?.clientName ?? "",
    authorizationNumber: agency?.authorizationNumber ?? "",
    expiresOn: agency?.expiresOn ?? "",
    file: null,
  });
  const { save } = useAgencyActions();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.clientName.trim() || !form.authorizationNumber.trim()) return;
    await save.mutateAsync({
      id: agency?.id,
      projectId: projectId ?? agency?.projectId ?? null,
      clientName: form.clientName,
      authorizationNumber: form.authorizationNumber,
      expiresOn: form.expiresOn || null,
      file: form.file,
    });
    onDone();
  };
  const input = "w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm";
  return (
    <form onSubmit={submit} className="space-y-3">
      <input className={input} placeholder="اسم العميل *" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
      <input className={input} placeholder="رقم الوكالة / التفويض *" value={form.authorizationNumber} onChange={(e) => setForm({ ...form, authorizationNumber: e.target.value })} />
      <label className="block text-sm text-muted-foreground">تاريخ الانتهاء
        <input type="date" dir="ltr" className={`${input} mt-1 text-left`} value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />
      </label>
      <label className="block text-sm text-muted-foreground">مرفق الوكالة
        <input type="file" className={`${input} mt-1`} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
      </label>
      {agency?.attachmentName && !form.file && <p className="text-xs text-muted-foreground">المرفق الحالي: {agency.attachmentName}</p>}
      <button disabled={save.isPending} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
        {save.isPending ? "جاري الحفظ..." : "حفظ الوكالة"}
      </button>
    </form>
  );
}

function AgencyRow({ agency, onEdit }: { agency: AgencyRecord; onEdit: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold truncate">{agency.clientName || "وكالة غير مكتملة"}</h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${agency.status === "expired" ? "bg-red-500/15 text-red-500" : "bg-green-500/15 text-green-500"}`}>
            {agency.status === "expired" ? "منتهية" : "سارية"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">رقم الوكالة: {agency.authorizationNumber || "—"}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {agency.projectId ? <Link className="text-primary hover:underline" to={`/projects/${agency.projectId}`}>{agency.projectName || "مشروع مرتبط"}</Link> : "وكالة عامة للمكتب"}
          {agency.expiresOn ? <span dir="ltr" className="inline-block mr-1">· تنتهي في {agency.expiresOn}</span> : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {agency.attachmentUrl && <a href={agency.attachmentUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted">عرض المرفق</a>}
        <button onClick={onEdit} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted">تعديل</button>
      </div>
    </div>
  );
}

export default function Agencies() {
  const { data: agencies = [], isLoading } = useAgencies();
  const { canEdit } = getArchivePermissions();
  const [showGeneral, setShowGeneral] = useState(false);
  const [editing, setEditing] = useState<AgencyRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">الوكالات</h1><p className="text-sm text-muted-foreground mt-1">مرآة مركزية لوكالات المشاريع والوكالات العامة</p></div>
        {canEdit && <button onClick={() => { setEditing(null); setShowGeneral(true); }} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">+ وكالة عامة</button>}
      </div>
      {isLoading ? <div className="h-28 rounded-2xl bg-muted animate-pulse" /> : agencies.length === 0 ? <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">لا توجد وكالات بعد.</div> :
        <div className="space-y-3">{agencies.map((agency) => <AgencyRow key={agency.id} agency={agency} onEdit={() => { setEditing(agency); setShowGeneral(true); }} />)}</div>}
      {canEdit && showGeneral && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowGeneral(false)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-4">{editing ? "تعديل الوكالة" : "إضافة وكالة عامة"}</h2>
            <AgencyForm agency={editing ?? undefined} onDone={() => { setShowGeneral(false); setToast({ message: "تم حفظ الوكالة", type: "success" }); }} />
          </div>
        </div>
      )}
    </div>
  );
}

export { AgencyForm };