import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAllMeetings, useGlobalCreateMeeting, useAttachmentActions } from "../../controllers/useGlobal";
import { useProjects } from "../../controllers/useProjects";
import EmptyState from "../components/shared/EmptyState";
import { useLanguage } from "../../contexts/LanguageContext";
import { CalendarCheck, MapPin, Users, ExternalLink, Plus, X } from "lucide-react";
import { getArchivePermissions } from "../../controllers/permissions";

const inputCls = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm";
const btnPrimary = "w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 mt-2";

function AddMeetingModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { data: projects } = useProjects();
  const create = useGlobalCreateMeeting();
  const [form, setForm] = useState({ projectId: "", title: "", date: "", location: "", agenda: "", notes: "" });
  const attachment = useAttachmentActions(form.projectId);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!form.projectId || !form.title.trim() || !form.date) return;
    const meeting = await create.mutateAsync({
      projectId: form.projectId,
      data: { title: form.title, date: form.date, location: form.location || null, agenda: form.agenda || null, notes: form.notes || null, attendees: [] },
    });
    if (attachmentFile) {
      await attachment.add.mutateAsync({
        entityType: "meeting",
        entityId: (meeting as { id: string }).id,
        file: attachmentFile,
        name: attachmentFile.name,
        customType: "مرفق اجتماع",
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 relative" style={{ background: "rgba(12,10,25,0.97)" }}>
        <button onClick={onClose} className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        <h2 className="font-bold text-lg mb-4 text-center">{t("addMeeting")}</h2>
        <div className="space-y-3">
          <div><label className="block text-sm font-medium mb-1">{t("projectField")}</label>
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputCls}>
              <option value="">{t("chooseProject")}</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium mb-1">{t("meetingTitle")}</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t("meetingTitlePh")} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">{t("meetingDate")}</label>
              <input type="date" lang="en-GB" dir="rtl" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={`${inputCls} text-right archive-date-input`} style={{ direction: "rtl", textAlign: "right" }} />
            </div>
            <div><label className="block text-sm font-medium mb-1">{t("meetingLocation")}</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder={t("meetingLocationPh")} className={inputCls} />
            </div>
          </div>
          <div><label className="block text-sm font-medium mb-1">{t("agenda")}</label>
            <textarea value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))} rows={2} placeholder="اكتب محاور ونقاط الاجتماع الرئيسية هنا" className={`${inputCls} resize-none`} dir="rtl" />
          </div>
          <div><label className="block text-sm font-medium mb-1">{t("notes")}</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">إرفاق ملف</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-muted-foreground file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary" />
            <p className="text-xs text-muted-foreground mt-1">PDF أو صورة أو مستند Word</p>
          </div>
          <button onClick={handleSubmit} disabled={create.isPending || attachment.add.isPending || !form.projectId || !form.title.trim() || !form.date} className={btnPrimary}>
            {create.isPending || attachment.add.isPending ? t("meetingAdding") : t("addMeetingBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AllMeetings() {
  const { t } = useLanguage();
  const { canEdit } = getArchivePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useAllMeetings(q || undefined);

  useEffect(() => {
    if (canEdit && searchParams.get("add") === "1") {
      setShowAdd(true);
      setSearchParams({}, { replace: true });
    }
  }, [canEdit, searchParams, setSearchParams]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("meetings")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("meetingsSub")}</p>
        </div>
        {canEdit && <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)", color: "#fff", boxShadow: "0 0 20px rgba(0,240,255,0.30)" }}>
          <Plus className="w-4 h-4" /> {t("addBtn")}
        </button>}
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("searchMeeting")}
        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm" />

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl animate-pulse bg-muted" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon="🤝" title={t("noMeetings")} description={t("noMeetingsSub")} />
      ) : (
        <div className="space-y-3">
          {data.map(m => (
            <div key={m.id} className="liquid-glass-card rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.16) 0%, rgba(99,102,241,0.12) 100%)", border: "1px solid rgba(0,240,255,0.22)" }}>
                  <CalendarCheck className="w-5 h-5" style={{ color: "#00f0ff" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground">{m.title}</h3>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="font-medium" style={{ color: "#00f0ff" }}>{m.date}</span>
                    {m.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.location}</span>}
                    {m.attendees?.length > 0 && (
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.attendees.length} {t("attendees")}</span>
                    )}
                  </div>
                  <Link to={`/projects/${m.projectId}`} className="text-xs mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: "#a855f7" }}>
                    <ExternalLink className="w-3 h-3" />{m.projectName}
                  </Link>
                </div>
              </div>
              {m.agenda && <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">{t("agendaPrefix")} {m.agenda}</p>}
            </div>
          ))}
        </div>
      )}
      {canEdit && showAdd && <AddMeetingModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
