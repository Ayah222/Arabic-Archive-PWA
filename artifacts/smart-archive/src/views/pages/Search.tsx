import { useState } from "react";
import { Link } from "react-router-dom";
import { useSearch } from "../../controllers/useGlobal";
import { useLanguage } from "../../contexts/LanguageContext";
import { Search as SearchIcon, FolderOpen, HardHat, FileSignature, CalendarCheck, Mail, FileText, Paperclip, Wallet } from "lucide-react";

function Section({ title, icon: Icon, color, children }: { title: string; icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <h3 className="font-bold text-sm text-foreground">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function SearchPage() {
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isFetching } = useSearch(q, from, to);

  const total = data
    ? data.projects.length + data.contractors.length + data.contracts.length + data.meetings.length + data.letters.length + data.documents.length + data.attachments.length + data.finance.length
    : 0;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("search")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("searchSub")}</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full pr-12 pl-4 py-3.5 rounded-2xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          autoFocus />
        {isFetching && <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">من تاريخ
          <input type="date" lang="en-GB" dir="rtl" value={from} onChange={e => setFrom(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground archive-date-input" />
        </label>
        <label className="text-xs text-muted-foreground">إلى تاريخ
          <input type="date" lang="en-GB" dir="rtl" value={to} onChange={e => setTo(e.target.value)}
            min={from || undefined}
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground archive-date-input" />
        </label>
      </div>

      {(q.length > 1 || from || to) && data && (
        <>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} ${t("results")}` : t("noResults")}
          </p>

          <div className="space-y-6">
            {data.projects.length > 0 && (
              <Section title={t("projects")} icon={FolderOpen} color="#00f0ff">
                {data.projects.map(p => (
                  <Link key={p.id} to={`/projects/${p.id}`} className="block liquid-glass-card rounded-xl p-3.5 hover:opacity-80 transition-opacity">
                    <div className="font-medium text-foreground">{p.name}</div>
                     <div className="text-xs text-muted-foreground mt-0.5">{p.client} • {p.startDate} • {p.progress}%</div>
                  </Link>
                ))}
              </Section>
            )}
            {data.contractors.length > 0 && (
              <Section title={t("contractors")} icon={HardHat} color="#a855f7">
                {data.contractors.map(c => (
                  <div key={c.id} className="liquid-glass-card rounded-xl p-3.5">
                    <div className="font-medium text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.specialty} • {c.projectName}</div>
                  </div>
                ))}
              </Section>
            )}
            {data.contracts.length > 0 && (
              <Section title={t("contracts")} icon={FileSignature} color="#f0a500">
                {data.contracts.map(c => (
                  <div key={c.id} className="liquid-glass-card rounded-xl p-3.5">
                    <div className="font-medium text-foreground">{c.title}</div>
                     <div className="text-xs text-muted-foreground mt-0.5">{c.party} • {c.startDate} — {c.endDate} • {c.projectName}</div>
                  </div>
                ))}
              </Section>
            )}
            {data.meetings.length > 0 && (
              <Section title={t("meetings")} icon={CalendarCheck} color="#00e5ff">
                {data.meetings.map(m => (
                  <div key={m.id} className="liquid-glass-card rounded-xl p-3.5">
                    <div className="font-medium text-foreground">{m.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.date} • {m.projectName}</div>
                  </div>
                ))}
              </Section>
            )}
            {data.letters.length > 0 && (
              <Section title={t("letters")} icon={Mail} color="#ff0080">
                {data.letters.map(l => (
                  <div key={l.id} className="liquid-glass-card rounded-xl p-3.5">
                    <div className="font-medium text-foreground">{l.subject}</div>
                     <div className="text-xs text-muted-foreground mt-0.5">{l.autoRef || l.reference || "بدون مرجع"} • {l.date} • {l.projectName}</div>
                  </div>
                ))}
              </Section>
            )}
            {data.documents.length > 0 && (
              <Section title="المستندات" icon={FileText} color="#22c55e">
                {data.documents.map(d => (
                  <Link key={d.id} to={`/projects/${d.projectId}`} className="block liquid-glass-card rounded-xl p-3.5">
                    <div className="font-medium text-foreground">{d.name}</div>
                     <div className="text-xs text-muted-foreground mt-0.5">{d.docRef || "بدون مرجع"} • {d.createdAt.slice(0, 10)} • {d.projectName}</div>
                  </Link>
                ))}
              </Section>
            )}
            {data.finance.length > 0 && (
              <Section title="المالية" icon={Wallet} color="#14b8a6">
                {data.finance.map(record => (
                  <div key={record.id} className="liquid-glass-card rounded-xl p-3.5">
                    <div className="font-medium text-foreground">{record.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {record.date} • {record.category} • {record.projectName}
                    </div>
                  </div>
                ))}
              </Section>
            )}
            {data.attachments.length > 0 && (
              <Section title="المرفقات" icon={Paperclip} color="#f97316">
                {data.attachments.map(a => (
                  <a key={a.id} href={a.dataUrl} target="_blank" rel="noreferrer" className="block liquid-glass-card rounded-xl p-3.5">
                    <div className="font-medium text-foreground">{a.name}</div>
                     <div className="text-xs text-muted-foreground mt-0.5">{a.customType} • {a.uploadedAt.slice(0, 10)} • {a.projectName}</div>
                  </a>
                ))}
              </Section>
            )}
          </div>
        </>
      )}

      {q.length === 0 && !from && !to && (
        <div className="text-center py-16">
          <SearchIcon className="w-14 h-14 mx-auto mb-4 opacity-10" />
          <p className="text-muted-foreground">{t("searchPrompt")}</p>
        </div>
      )}
    </div>
  );
}
