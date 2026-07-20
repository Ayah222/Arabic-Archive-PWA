import { useState } from "react";
import { Link } from "react-router-dom";
import { useAllMeetings } from "../../controllers/useGlobal";
import EmptyState from "../components/shared/EmptyState";
import { CalendarCheck, MapPin, Users, ExternalLink } from "lucide-react";

export default function AllMeetings() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useAllMeetings(q || undefined);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الاجتماعات</h1>
        <p className="text-sm text-muted-foreground mt-1">جميع الاجتماعات عبر المشاريع</p>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث عن اجتماع..."
        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        dir="rtl" />

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl animate-pulse bg-muted" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon="🤝" title="لا توجد اجتماعات" description="أضف اجتماعات من صفحة تفاصيل المشروع" />
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
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.attendees.length} حاضرين</span>
                    )}
                  </div>
                  <Link to={`/projects/${m.projectId}`} className="text-xs mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: "#a855f7" }}>
                    <ExternalLink className="w-3 h-3" />{m.projectName}
                  </Link>
                </div>
              </div>
              {m.agenda && <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">جدول الأعمال: {m.agenda}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
