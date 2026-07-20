import { useState } from "react";
import { Link } from "react-router-dom";
import { useAllLetters } from "../../controllers/useGlobal";
import EmptyState from "../components/shared/EmptyState";
import { Mail, ArrowUpRight, ArrowDownLeft, ExternalLink } from "lucide-react";

export default function AllLetters() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useAllLetters(q || undefined);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الخطابات والمراسلات</h1>
        <p className="text-sm text-muted-foreground mt-1">جميع الخطابات الصادرة والواردة</p>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث عن خطاب..."
        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        dir="rtl" />

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse bg-muted" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon="✉️" title="لا توجد خطابات" description="أضف خطابات من صفحة تفاصيل المشروع" />
      ) : (
        <div className="space-y-3">
          {data.map(l => {
            const isOut = l.direction === "outgoing";
            return (
              <div key={l.id} className="liquid-glass-card rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isOut
                        ? "linear-gradient(135deg, rgba(255,0,128,0.16) 0%, rgba(112,0,255,0.10) 100%)"
                        : "linear-gradient(135deg, rgba(0,240,255,0.16) 0%, rgba(112,0,255,0.10) 100%)",
                      border: `1px solid ${isOut ? "rgba(255,0,128,0.25)" : "rgba(0,240,255,0.22)"}`,
                    }}>
                    {isOut
                      ? <ArrowUpRight className="w-5 h-5" style={{ color: "#ff0080" }} />
                      : <ArrowDownLeft className="w-5 h-5" style={{ color: "#00f0ff" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground truncate">{l.subject}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isOut ? "من" : "من"}: {l.from} ← {l.to}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span style={{ color: isOut ? "#ff0080" : "#00f0ff" }}>{l.date}</span>
                      {l.reference && <span>مرجع: {l.reference}</span>}
                    </div>
                    <Link to={`/projects/${l.projectId}`} className="text-xs mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: "#a855f7" }}>
                      <ExternalLink className="w-3 h-3" />{l.projectName}
                    </Link>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${isOut ? "text-pink-400 bg-pink-400/10 border border-pink-400/25" : "text-cyan-400 bg-cyan-400/10 border border-cyan-400/25"}`}>
                    {isOut ? "صادر" : "وارد"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
