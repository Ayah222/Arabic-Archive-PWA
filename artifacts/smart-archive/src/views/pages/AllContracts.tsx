import { useState } from "react";
import { Link } from "react-router-dom";
import { useAllContracts } from "../../controllers/useGlobal";
import EmptyState from "../components/shared/EmptyState";
import { FileSignature, ExternalLink, Calendar, DollarSign } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  active: "نشط", completed: "مكتمل", pending: "قيد الانتظار", cancelled: "ملغي"
};
const STATUS_COLOR: Record<string, string> = {
  active: "text-cyan-400 bg-cyan-400/10 border-cyan-400/25",
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/25",
};

export default function AllContracts() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useAllContracts(q || undefined);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">العقود</h1>
        <p className="text-sm text-muted-foreground mt-1">جميع العقود عبر المشاريع</p>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث عن عقد..."
        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        dir="rtl" />

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl animate-pulse bg-muted" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon="📋" title="لا توجد عقود" description="أضف عقوداً من صفحة تفاصيل المشروع" />
      ) : (
        <div className="space-y-3">
          {data.map(c => (
            <div key={c.id} className="liquid-glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.20) 0%, rgba(0,240,255,0.12) 100%)", border: "1px solid rgba(168,85,247,0.30)" }}>
                    <FileSignature className="w-5 h-5" style={{ color: "#a855f7" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground">{c.title}</h3>
                    <p className="text-sm text-muted-foreground">{c.party}</p>
                    <Link to={`/projects/${c.projectId}`} className="text-xs mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: "#00f0ff" }}>
                      <ExternalLink className="w-3 h-3" />{c.projectName}
                    </Link>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border shrink-0 ${STATUS_COLOR[c.status] ?? "text-muted-foreground bg-muted"}`}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{c.value.toLocaleString("ar-SA")} ر.س</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{c.startDate} — {c.endDate}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
