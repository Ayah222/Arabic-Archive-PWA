import { useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useProject } from "../../controllers/useProjects";
import { useContracts, useLetters, useMeetings } from "../../controllers/useProjectDetails";
import {
  CONTRACT_STATUS_LABELS,
  formatCurrency,
  formatDate,
  PROJECT_STATUS_LABELS,
  type ContractStatus,
  type ProjectStatus,
} from "../../models/types";

function ReportSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function EmptyTableRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-slate-400">
        لا توجد سجلات مؤرشفة.
      </td>
    </tr>
  );
}

export default function ProjectReport() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const projectQuery = useProject(id);
  const contractsQuery = useContracts(id).list;
  const meetingsQuery = useMeetings(id).list;
  const lettersQuery = useLetters(id).list;

  const project = projectQuery.data;
  const contracts = contractsQuery.data ?? [];
  const meetings = meetingsQuery.data ?? [];
  const letters = lettersQuery.data ?? [];
  const isLoading =
    projectQuery.isLoading ||
    contractsQuery.isLoading ||
    meetingsQuery.isLoading ||
    lettersQuery.isLoading;

  const handlePrint = () => {
    const report = reportRef.current;
    if (!report || !project) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>تقرير مشروع ${project.name}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 24px; color: #172033; font-family: Tahoma, Arial, sans-serif; background: #fff; }
            .report-sheet { max-width: 960px; margin: 0 auto; }
            .report-header { border-bottom: 2px solid #4f46e5; padding-bottom: 18px; margin-bottom: 20px; }
            h1 { margin: 0 0 6px; font-size: 26px; color: #111827; }
            h2 { margin: 0; font-size: 17px; color: #111827; }
            p { margin: 0; }
            .report-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
            .report-meta > div, .report-summary > div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px; }
            .report-meta span, .report-summary span { display: block; color: #64748b; font-size: 11px; margin-bottom: 4px; }
            .report-meta strong, .report-summary strong { font-size: 14px; color: #172033; }
            .report-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
            section { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 0 0 18px; break-inside: avoid; }
            .section-title { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; }
            .count { color: #4338ca; background: #eef2ff; border-radius: 999px; font-size: 12px; font-weight: bold; padding: 4px 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #312e81; color: white; text-align: right; padding: 9px; font-weight: bold; }
            td { padding: 9px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            tr:nth-child(even) td { background: #fafafa; }
            .empty { text-align: center; color: #94a3b8; padding: 18px; }
            .footer { border-top: 1px solid #e2e8f0; padding-top: 12px; color: #64748b; font-size: 11px; }
            @page { size: A4; margin: 14mm; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${report.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-8">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">المشروع غير موجود.</p>
        <Link to="/projects" className="font-semibold text-primary hover:underline">
          العودة إلى المشاريع
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          onClick={() => navigate(`/projects/${id}`)}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
        >
          ← العودة إلى المشروع
        </button>
        <button
          onClick={handlePrint}
          className="rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            boxShadow: "0 8px 20px rgba(79,70,229,0.25)",
          }}
        >
          طباعة / حفظ كـ PDF
        </button>
      </div>

      <div ref={reportRef} className="report-sheet space-y-5 rounded-3xl bg-slate-50 p-5 md:p-8">
        <header className="report-header border-b-2 border-indigo-600 pb-5">
          <p className="mb-2 text-sm font-bold text-indigo-600">نظام الأرشيف الذكي</p>
          <h1 className="text-2xl font-black text-slate-950">تقرير شامل للمشروع</h1>
          <p className="mt-1 text-sm text-slate-500">تم إنشاؤه في {new Date().toLocaleDateString("ar-SA")}</p>

          <div className="report-meta mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="block text-xs text-slate-500">اسم المشروع</span>
              <strong className="text-sm text-slate-900">{project.name}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="block text-xs text-slate-500">العميل</span>
              <strong className="text-sm text-slate-900">{project.client}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="block text-xs text-slate-500">الحالة / الإنجاز</span>
              <strong className="text-sm text-slate-900">
                {PROJECT_STATUS_LABELS[project.status as ProjectStatus]} · {project.progress}%
              </strong>
            </div>
          </div>
        </header>

        <div className="report-summary grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <span className="text-xs text-slate-500">العقود المؤرشفة</span>
            <strong className="mt-1 block text-2xl text-indigo-700">{contracts.length}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <span className="text-xs text-slate-500">الاجتماعات المؤرشفة</span>
            <strong className="mt-1 block text-2xl text-indigo-700">{meetings.length}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <span className="text-xs text-slate-500">الخطابات المؤرشفة</span>
            <strong className="mt-1 block text-2xl text-indigo-700">{letters.length}</strong>
          </div>
        </div>

        <ReportSection title="العقود" count={contracts.length}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="bg-indigo-900 text-white">
                  <th className="px-3 py-2.5">العقد</th>
                  <th className="px-3 py-2.5">الطرف</th>
                  <th className="px-3 py-2.5">القيمة</th>
                  <th className="px-3 py-2.5">المدة</th>
                  <th className="px-3 py-2.5">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 ? <EmptyTableRow colSpan={5} /> : contracts.map((contract) => (
                  <tr key={contract.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-800">{contract.title}</td>
                    <td className="px-3 py-3 text-slate-600">{contract.party}</td>
                    <td className="px-3 py-3 text-slate-600">{formatCurrency(contract.value)}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {CONTRACT_STATUS_LABELS[contract.status as ContractStatus]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection title="الاجتماعات" count={meetings.length}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="bg-indigo-900 text-white">
                  <th className="px-3 py-2.5">عنوان الاجتماع</th>
                  <th className="px-3 py-2.5">التاريخ</th>
                  <th className="px-3 py-2.5">الموقع</th>
                  <th className="px-3 py-2.5">الحضور</th>
                  <th className="px-3 py-2.5">الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {meetings.length === 0 ? <EmptyTableRow colSpan={5} /> : meetings.map((meeting) => (
                  <tr key={meeting.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-800">{meeting.title}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(meeting.date)}</td>
                    <td className="px-3 py-3 text-slate-600">{meeting.location || "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{meeting.attendees.join("، ") || "—"}</td>
                    <td className="max-w-xs px-3 py-3 text-slate-600">{meeting.notes || meeting.agenda || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection title="الخطابات" count={letters.length}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="bg-indigo-900 text-white">
                  <th className="px-3 py-2.5">الموضوع</th>
                  <th className="px-3 py-2.5">النوع</th>
                  <th className="px-3 py-2.5">من</th>
                  <th className="px-3 py-2.5">إلى</th>
                  <th className="px-3 py-2.5">التاريخ</th>
                  <th className="px-3 py-2.5">المرجع</th>
                </tr>
              </thead>
              <tbody>
                {letters.length === 0 ? <EmptyTableRow colSpan={6} /> : letters.map((letter) => (
                  <tr key={letter.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-800">{letter.subject}</td>
                    <td className="px-3 py-3 text-slate-600">{letter.direction === "incoming" ? "وارد" : "صادر"}</td>
                    <td className="px-3 py-3 text-slate-600">{letter.from}</td>
                    <td className="px-3 py-3 text-slate-600">{letter.to}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(letter.date)}</td>
                    <td className="px-3 py-3 text-slate-600">{letter.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          هذا التقرير مُنشأ من السجلات المؤرشفة للمشروع بتاريخ {new Date().toLocaleDateString("ar-SA")}.
        </footer>
      </div>
    </div>
  );
}