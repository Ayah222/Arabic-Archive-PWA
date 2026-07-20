import { useState } from "react";
import { Link } from "react-router-dom";
import { useAllContractors } from "../../controllers/useGlobal";
import EmptyState from "../components/shared/EmptyState";
import { HardHat, Phone, Mail, ExternalLink } from "lucide-react";

export default function AllContractors() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useAllContractors(q || undefined);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">المقاولون</h1>
        <p className="text-sm text-muted-foreground mt-1">جميع المقاولين عبر المشاريع</p>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث عن مقاول..."
        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        dir="rtl" />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-2xl animate-pulse bg-muted" />)}
        </div>
      ) : !data?.length ? (
        <EmptyState icon="👷" title="لا يوجد مقاولون" description="أضف مقاولين من صفحة المشاريع" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(c => (
            <div key={c.id} className="liquid-glass-card rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.18) 0%, rgba(112,0,255,0.14) 100%)", border: "1px solid rgba(0,240,255,0.25)" }}>
                  <HardHat className="w-6 h-6" style={{ color: "#00f0ff" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground truncate">{c.name}</h3>
                  <p className="text-sm text-muted-foreground">{c.specialty}</p>
                  <Link to={`/projects/${c.projectId}`}
                    className="text-xs mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity"
                    style={{ color: "#00f0ff" }}>
                    <ExternalLink className="w-3 h-3" />
                    {c.projectName}
                  </Link>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${c.status === "active" ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/25" : "text-muted-foreground bg-muted"}`}>
                  {c.status === "active" ? "نشط" : "غير نشط"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
              </div>
              {c.notes && <p className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
