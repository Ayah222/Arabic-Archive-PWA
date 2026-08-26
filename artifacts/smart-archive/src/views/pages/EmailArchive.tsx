import { useMemo, useState } from "react";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Inbox,
  Loader2,
  Mail,
  Paperclip,
  Printer,
  RefreshCw,
  Search,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { getCurrentUser } from "../../controllers/useGlobal";
import {
  downloadArchivedEmailAttachment,
  useArchivedEmail,
  useEmailArchive,
  useEmailArchiveActions,
  useEmailArchiveDashboard,
  type EmailArchiveFilters,
} from "../../controllers/useGlobal";

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(0,240,255,0.16)",
  color: "inherit",
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 بايت";
  const units = ["بايت", "ك.ب", "م.ب", "ج.ب"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} ${units[index]}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

function textPreview(value?: string | null) {
  return (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: React.ElementType; tone: string }) {
  return (
    <div className="liquid-glass-card rounded-2xl p-4 flex gap-3 items-center">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tone}18`, border: `1px solid ${tone}38` }}>
        <Icon className="w-5 h-5" style={{ color: tone }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function EmailArchive() {
  const [filters, setFilters] = useState<EmailArchiveFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentUser = getCurrentUser();
  const { data: emails = [], isLoading } = useEmailArchive(filters);
  const { data: dashboard } = useEmailArchiveDashboard();
  const { data: selected, isLoading: selectedLoading } = useArchivedEmail(selectedId);
  const { sync } = useEmailArchiveActions();
  const isAdmin = currentUser?.role === "admin";

  const resultText = useMemo(() => {
    if (sync.isSuccess && sync.data) {
      return `اكتملت المزامنة: ${sync.data.added} رسالة جديدة و${sync.data.attachments} مرفق.`;
    }
    if (sync.isError) return "تعذر مزامنة Gmail. تحقق من حالة الاتصال ثم حاول مرة أخرى.";
    return null;
  }, [sync.data, sync.isError, sync.isSuccess]);

  const updateFilter = (field: keyof EmailArchiveFilters, value: string) => {
    setFilters((previous) => ({ ...previous, [field]: value || undefined }));
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6" dir="rtl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="w-6 h-6" style={{ color: "#00f0ff" }} />
            <h1 className="text-2xl font-black text-foreground">أرشيف البريد</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">حفظ آمن للرسائل الواردة والصادرة من Gmail مع مرفقاتها الأصلية.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending || Boolean(dashboard?.syncing)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60"
            style={{ background: "linear-gradient(90deg, #00bcd4, #6d28d9)", color: "#fff", boxShadow: "0 0 20px rgba(0,240,255,0.22)" }}
          >
            {sync.isPending || dashboard?.syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            مزامنة Gmail الآن
          </button>
        )}
      </div>

      {resultText && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ border: `1px solid ${sync.isError ? "rgba(255,80,120,.45)" : "rgba(0,255,136,.34)"}`, background: sync.isError ? "rgba(255,80,120,.08)" : "rgba(0,255,136,.07)" }}>
          {sync.isError ? <TriangleAlert className="w-4 h-4" style={{ color: "#ff5b86" }} /> : <CheckCircle2 className="w-4 h-4" style={{ color: "#00df8b" }} />}
          {resultText}
        </div>
      )}

      {dashboard?.lastError && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ border: "1px solid rgba(240,165,0,.38)", background: "rgba(240,165,0,.08)" }}>
          <TriangleAlert className="w-4 h-4 shrink-0" style={{ color: "#f0a500" }} />
          <span>آخر خطأ للمزامنة: {dashboard.lastError}</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="إجمالي الرسائل" value={dashboard?.messageCount ?? 0} icon={Mail} tone="#00f0ff" />
        <StatCard label="البريد الوارد" value={dashboard?.incomingCount ?? 0} icon={ArrowDownLeft} tone="#00df8b" />
        <StatCard label="البريد الصادر" value={dashboard?.outgoingCount ?? 0} icon={ArrowUpRight} tone="#c084fc" />
        <StatCard label="المساحة المؤرشفة" value={formatBytes(dashboard?.storageBytes ?? 0)} icon={Archive} tone="#f0a500" />
      </div>

      <div className="liquid-glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Search className="w-4 h-4" style={{ color: "#00f0ff" }} /> بحث وفلاتر
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <label className="xl:col-span-2 relative">
            <Search className="w-4 h-4 absolute right-3 top-3 opacity-50" />
            <input value={filters.q ?? ""} onChange={(event) => updateFilter("q", event.target.value)} placeholder="كلمات في الموضوع أو النص أو العنوان…" className="w-full rounded-xl py-2.5 pr-9 pl-3 text-sm outline-none" style={inputStyle} />
          </label>
          <select value={filters.direction ?? ""} onChange={(event) => updateFilter("direction", event.target.value)} className="rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle}>
            <option value="">كل الاتجاهات</option><option value="incoming">وارد</option><option value="outgoing">صادر</option>
          </select>
          <input value={filters.from ?? ""} onChange={(event) => updateFilter("from", event.target.value)} placeholder="من" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
          <input value={filters.to ?? ""} onChange={(event) => updateFilter("to", event.target.value)} placeholder="إلى" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
          <button onClick={() => setFilters({})} className="rounded-xl px-3 py-2.5 text-sm font-bold" style={{ border: "1px solid rgba(255,255,255,.13)", color: "rgba(255,255,255,.72)" }}>مسح الفلاتر</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <CalendarDays className="w-3.5 h-3.5 opacity-60" />
          <span className="text-muted-foreground">التاريخ:</span>
          <input type="date" value={filters.start ?? ""} onChange={(event) => updateFilter("start", event.target.value)} className="rounded-lg py-1.5 px-2 outline-none" style={inputStyle} />
          <span className="opacity-45">إلى</span>
          <input type="date" value={filters.end ?? ""} onChange={(event) => updateFilter("end", event.target.value)} className="rounded-lg py-1.5 px-2 outline-none" style={inputStyle} />
          <span className="mr-auto text-muted-foreground">{emails.length} نتيجة</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.9fr)] gap-5">
        <section className="space-y-3">
          {isLoading ? (
            [...Array(4)].map((_, index) => <div key={index} className="h-28 rounded-2xl animate-pulse bg-muted" />)
          ) : emails.length === 0 ? (
            <div className="liquid-glass-card rounded-2xl py-16 px-6 text-center">
              <Inbox className="w-11 h-11 mx-auto mb-3 opacity-35" style={{ color: "#00f0ff" }} />
              <h2 className="font-bold text-foreground">لا توجد رسائل مؤرشفة بعد</h2>
              <p className="text-sm text-muted-foreground mt-1">{isAdmin ? "ابدأ بالمزامنة الأولى لإضافة رسائل Gmail إلى الأرشيف." : "سيظهر البريد هنا بعد أن ينفذ المدير المزامنة."}</p>
            </div>
          ) : emails.map((email) => {
            const outgoing = email.direction === "outgoing";
            const active = email.id === selectedId;
            return (
              <button key={email.id} onClick={() => setSelectedId(email.id)} className="w-full text-right liquid-glass-card rounded-2xl p-4 transition-all hover:-translate-y-0.5" style={active ? { border: "1px solid rgba(0,240,255,.54)", boxShadow: "0 0 24px rgba(0,240,255,.1)" } : undefined}>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: outgoing ? "rgba(192,132,252,.14)" : "rgba(0,223,139,.13)", border: `1px solid ${outgoing ? "rgba(192,132,252,.3)" : "rgba(0,223,139,.27)"}` }}>
                    {outgoing ? <Send className="w-4 h-4" style={{ color: "#c084fc" }} /> : <Inbox className="w-4 h-4" style={{ color: "#00df8b" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-sm text-foreground truncate">{email.subject}</h3>
                      <span className="text-[11px] shrink-0 text-muted-foreground">{formatDate(email.sentAt)}</span>
                    </div>
                    <p className="text-xs mt-1 truncate text-muted-foreground">{outgoing ? "إلى: " : "من: "}{outgoing ? email.to : email.from}</p>
                    <p className="text-xs mt-1.5 opacity-70 line-clamp-2 text-muted-foreground">{textPreview(email.preview || email.snippet)}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">{outgoing ? "صادر" : "وارد"}</span>
                      {email.attachments.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{email.attachments.length}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <aside className="liquid-glass-card rounded-2xl min-h-[430px] xl:sticky xl:top-20 overflow-hidden">
          {!selectedId ? (
            <div className="h-full min-h-[430px] flex flex-col items-center justify-center p-8 text-center">
              <FileText className="w-11 h-11 mb-3 opacity-30" style={{ color: "#00f0ff" }} />
              <h2 className="font-bold text-foreground">اختر رسالة للعرض</h2>
              <p className="text-sm text-muted-foreground mt-1">ستظهر الرسالة والمرفقات وسجلها الزمني هنا.</p>
            </div>
          ) : selectedLoading || !selected ? (
            <div className="h-full min-h-[430px] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin" style={{ color: "#00f0ff" }} /></div>
          ) : (
            <div>
              <div className="p-5 border-b border-white/10">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: selected.direction === "outgoing" ? "rgba(192,132,252,.15)" : "rgba(0,223,139,.14)" }}>
                    {selected.direction === "outgoing" ? <Send className="w-4 h-4" style={{ color: "#c084fc" }} /> : <Inbox className="w-4 h-4" style={{ color: "#00df8b" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-black text-base text-foreground leading-6">{selected.subject}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(selected.sentAt)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => window.print()} title="طباعة" className="p-2 rounded-lg hover:bg-white/10"><Printer className="w-4 h-4" /></button>
                    <button onClick={() => setSelectedId(null)} title="إغلاق" className="p-2 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="mt-4 text-xs leading-6 space-y-1 break-words text-muted-foreground">
                  <p><b className="text-foreground">من:</b> {selected.from || "—"}</p>
                  <p><b className="text-foreground">إلى:</b> {selected.to || "—"}</p>
                  {selected.cc && <p><b className="text-foreground">نسخة:</b> {selected.cc}</p>}
                  {selected.replyTo && <p><b className="text-foreground">الرد إلى:</b> {selected.replyTo}</p>}
                </div>
              </div>
              <div className="p-5 space-y-5">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-foreground/90 max-h-[380px] overflow-auto">{selected.bodyText || textPreview(selected.bodyHtml) || selected.snippet || "لا يحتوي البريد على نص قابل للعرض."}</pre>
                {selected.attachments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2"><Paperclip className="w-4 h-4" style={{ color: "#00f0ff" }} /> المرفقات ({selected.attachments.length})</h3>
                    <div className="space-y-2">
                      {selected.attachments.map((attachment) => (
                        <button key={attachment.id} onClick={() => void downloadArchivedEmailAttachment(selected.id, attachment.id, attachment.filename)} className="w-full text-right flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,.1)" }}>
                          <FileText className="w-4 h-4 shrink-0" style={{ color: "#f0a500" }} />
                          <span className="flex-1 min-w-0 truncate text-xs text-foreground">{attachment.filename}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{formatBytes(attachment.size)}</span>
                          <Download className="w-4 h-4 shrink-0" style={{ color: "#00f0ff" }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground border-t border-white/10 pt-3">
                  خُتم الأرشفة: {formatDate(selected.archivedAt)} · رقم Gmail: {selected.gmailMessageId}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span>الحساب المتصل: {dashboard?.gmailAddress ?? "لم تتم المزامنة بعد"}</span>
        <span>آخر مزامنة ناجحة: {formatDate(dashboard?.lastSuccessAt ?? null)}</span>
        <span>المرفقات المؤرشفة: {dashboard?.attachmentCount ?? 0}</span>
      </div>
    </div>
  );
}