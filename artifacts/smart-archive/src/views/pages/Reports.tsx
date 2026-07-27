// Prompt 3: Per-project reports with PDF export
import { useState, useRef } from "react";
import { useReports, type ProjectReport } from "../../controllers/useGlobal";

const STATUS_LABELS: Record<string, string> = {
  active: "نشط", completed: "مكتمل", on_hold: "متوقف", cancelled: "ملغي",
};

const APPROVAL_LABELS: Record<string, string> = {
  under_review: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  approved_with_notes: "معتمد مع ملاحظات",
};

const DIST_LABELS: Record<string, string> = {
  not_sent: "لم يُرسل",
  sent: "تم الإرسال",
  received: "تم الاستلام",
};

function ReportCard({ report }: { report: ProjectReport }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><meta charset="utf-8">
      <title>تقرير ${report.project.name}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; color: #111; }
        h1,h2,h3 { color: #1e3a5f; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th { background: #1e3a5f; color: white; padding: 8px; }
        td { padding: 8px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #f5f5f5; }
        .badge-warn { color: #d97706; }
        .badge-ok { color: #16a34a; }
        .badge-err { color: #dc2626; }
        @media print { button { display: none !important; } }
      </style></head><body>
      ${el.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const pct = report.project.progress;

  return (
    <div className="liquid-glass-card rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{report.project.name}</h2>
          <p className="text-sm text-muted-foreground">{report.project.client} {report.project.location ? `· ${report.project.location}` : ""}</p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-1 inline-block">
            {STATUS_LABELS[report.project.status] ?? report.project.status}
          </span>
        </div>
        <div className="text-left shrink-0">
          <div className="text-2xl font-bold text-primary">{pct}%</div>
          <div className="text-xs text-muted-foreground">إنجاز</div>
        </div>
      </div>

      {/* Printable area */}
      <div ref={printRef}>
        <h1 style={{ display: "none" }}>تقرير مشروع: {report.project.name}</h1>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "المستندات الكلية", val: report.summary.totalDocuments },
            { label: "الخطابات الكلية", val: report.summary.totalLetters },
            { label: "العقود", val: report.summary.totalContracts },
            { label: "الاجتماعات", val: report.summary.totalMeetings },
            { label: "مستندات جديدة", val: report.summary.newDocumentsInPeriod },
            { label: "خطابات جديدة", val: report.summary.newLettersInPeriod },
            { label: "جهات الاتصال", val: report.summary.totalContacts },
          ].map((item) => (
            <div key={item.label} className="bg-secondary/40 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-foreground">{item.val}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Document status */}
        <div className="mt-4">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">حالة المستندات</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div className="rounded-xl p-3 bg-yellow-500/10 border border-yellow-500/20">
              <div className="font-bold text-yellow-400 text-lg">{report.documentStatus.underReview}</div>
              <div className="text-xs text-muted-foreground">قيد المراجعة</div>
            </div>
            <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/20">
              <div className="font-bold text-green-400 text-lg">{report.documentStatus.approved}</div>
              <div className="text-xs text-muted-foreground">معتمد</div>
            </div>
            <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20">
              <div className="font-bold text-red-400 text-lg">{report.documentStatus.rejected}</div>
              <div className="text-xs text-muted-foreground">مرفوض</div>
            </div>
            <div className="rounded-xl p-3 bg-orange-500/10 border border-orange-500/20">
              <div className="font-bold text-orange-400 text-lg">{report.documentStatus.overdue}</div>
              <div className="text-xs text-muted-foreground">متأخر</div>
            </div>
          </div>
        </div>

        {/* Overdue documents */}
        {report.overdueDocuments.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">المستندات المتأخرة</h3>
            <div className="space-y-2">
              {report.overdueDocuments.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl p-3 bg-red-500/8 border border-red-500/20">
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="text-xs text-red-400 font-semibold">{d.daysPending} يوم</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revision changes */}
        {report.revisionChanges.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">تغييرات الإصدارات في هذه الفترة</h3>
            <div className="space-y-2">
              {report.revisionChanges.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl p-3 bg-blue-500/8 border border-blue-500/20">
                  <span className="text-sm font-medium">{r.docName}</span>
                  <span className="text-xs text-blue-400">Rev {r.fromRev} → Rev {r.toRev} ({r.date})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending letters */}
        {report.pendingLetters.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">خطابات صادرة بانتظار التأكيد</h3>
            <div className="space-y-2">
              {report.pendingLetters.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl p-3 bg-orange-500/8 border border-orange-500/20">
                  <div>
                    <span className="text-sm font-medium block">{l.subject}</span>
                    <span className="text-xs text-muted-foreground">{l.autoRef} · إلى: {l.to}</span>
                  </div>
                  <span className="text-xs text-orange-400">{DIST_LABELS[l.distributionStatus] ?? l.distributionStatus}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expiring contracts */}
        {report.expiringContracts.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">عقود قاربت الانتهاء (خلال 60 يوم)</h3>
            <div className="space-y-2">
              {report.expiringContracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl p-3 bg-yellow-500/8 border border-yellow-500/20">
                  <div>
                    <span className="text-sm font-medium block">{c.title}</span>
                    <span className="text-xs text-muted-foreground">{c.party}</span>
                  </div>
                  <span className="text-xs text-yellow-400">{c.daysLeft} يوم متبقي</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Export button */}
      <button
        onClick={handlePrint}
        className="w-full py-3 rounded-xl font-bold text-sm transition-colors"
        style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.15) 0%, rgba(112,0,255,0.15) 100%)", border: "1px solid rgba(0,240,255,0.25)", color: "#00f0ff" }}
      >
        تصدير كـ PDF
      </button>
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const { data, isLoading } = useReports(period);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">التقارير</h1>
          <p className="text-sm text-muted-foreground mt-1">تقارير تفصيلية لكل مشروع على حدة</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod("weekly")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${period === "weekly" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
          >
            أسبوعي
          </button>
          <button
            onClick={() => setPeriod("monthly")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${period === "monthly" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
          >
            شهري
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        تاريخ التوليد: {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 rounded-2xl animate-pulse bg-muted" />)}
        </div>
      ) : !data?.length ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <p className="text-4xl mb-3">📊</p>
          <p>لا توجد مشاريع لعرض تقاريرها</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.map((report) => <ReportCard key={report.project.id} report={report} />)}
        </div>
      )}
    </div>
  );
}
