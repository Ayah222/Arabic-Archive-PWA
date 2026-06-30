import React, { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useAppContext } from "../context/AppContext";
import { mockLetters, mockMeetings, mockContractors } from "../data/mockData";
import { Button } from "../components/ui/button";
import {
  Search, Camera, FileText, FolderOpen, FileSignature,
  Mail, Calendar, HardHat, ArrowLeft, Loader2, Sparkles,
  Building2, CheckCircle2, ScanLine,
} from "lucide-react";

type CameraStep = "idle" | "capturing" | "analyzing" | "extracting" | "done";

const CAMERA_MOCK_RESULT = { refNumber: "خ/2026/001", type: "letter", id: "let_1" };

export default function SearchPage() {
  const { projects, documents, contracts, theme } = useAppContext();
  const isDark = theme === "dark";
  const [, setLocation] = useLocation();

  const [query, setQuery] = useState("");
  const [cameraStep, setCameraStep] = useState<CameraStep>("idle");
  const [cameraResult, setCameraResult] = useState<null | typeof CAMERA_MOCK_RESULT>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accent = isDark ? "#00f0ff" : "#6366f1";
  const textMain = isDark ? "rgba(255,255,255,0.92)" : "#1e1b4b";
  const textMuted = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";

  const trimmed = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!trimmed) return null;
    const matchProjects = projects.filter(p =>
      p.number.toLowerCase().includes(trimmed) ||
      p.name.toLowerCase().includes(trimmed) ||
      p.client.toLowerCase().includes(trimmed)
    );
    const matchContracts = contracts.filter(c =>
      c.number.toLowerCase().includes(trimmed) ||
      c.client.toLowerCase().includes(trimmed) ||
      c.classification.toLowerCase().includes(trimmed)
    );
    const matchLetters = mockLetters.filter(l =>
      (l.letterNumber ?? "").toLowerCase().includes(trimmed) ||
      l.name.toLowerCase().includes(trimmed) ||
      (l.letterEntity ?? "").toLowerCase().includes(trimmed) ||
      (l.letterSubject ?? "").toLowerCase().includes(trimmed)
    );
    const matchMeetings = mockMeetings.filter(m =>
      m.number.toLowerCase().includes(trimmed) ||
      m.name.toLowerCase().includes(trimmed)
    );
    const matchDocs = documents.filter(d =>
      d.number.toLowerCase().includes(trimmed) ||
      d.name.toLowerCase().includes(trimmed) ||
      (d.classification ?? "").toLowerCase().includes(trimmed)
    );
    return { matchProjects, matchContracts, matchLetters, matchMeetings, matchDocs };
  }, [trimmed, projects, contracts, documents]);

  const totalResults = results
    ? results.matchProjects.length + results.matchContracts.length + results.matchLetters.length +
      results.matchMeetings.length + results.matchDocs.length
    : 0;

  const startCameraSearch = () => {
    setCameraStep("capturing");
    setTimeout(() => setCameraStep("analyzing"), 1500);
    setTimeout(() => setCameraStep("extracting"), 3000);
    setTimeout(() => {
      setCameraStep("done");
      setCameraResult(CAMERA_MOCK_RESULT);
    }, 4500);
  };

  const resetCamera = () => {
    setCameraStep("idle");
    setCameraResult(null);
  };

  const fieldStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.80)",
    border: isDark ? "1px solid rgba(0,240,255,0.22)" : "1px solid rgba(99,102,241,0.25)",
    color: isDark ? "#e2e8f0" : "#1e293b",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: textMain }}>البحث الموحد</h1>
        <p className="text-sm" style={{ color: textMuted }}>ابحث عبر جميع المشاريع والعقود والخطابات والمستندات</p>
      </div>

      {/* Search Bar */}
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: isDark ? "rgba(255,255,255,0.024)" : "rgba(255,255,255,0.72)",
          border: isDark ? "1px solid rgba(0,240,255,0.18)" : "1px solid rgba(99,102,241,0.18)",
          backdropFilter: "blur(18px)", boxShadow: isDark ? "0 0 30px rgba(0,240,255,0.07)" : "0 4px 20px rgba(99,102,241,0.07)" }}>
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 pointer-events-none" style={{ color: accent }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="أدخل رقم المشروع، رقم العقد، رقم الخطاب، اسم المشروع، أو اسم العميل..."
            className="w-full rounded-xl pr-11 pl-4 py-3 text-sm border outline-none transition-all focus:ring-2"
            style={{ ...fieldStyle, fontSize: "0.95rem" }}
            autoFocus
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs" style={{ color: textMuted }}>
          {["PRJ-001", "MOH-2023-0041", "خ/2026/001", "وزارة الإسكان", "برج الأعمال"].map(hint => (
            <button key={hint} onClick={() => setQuery(hint)}
              className="px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
              style={{ background: isDark ? "rgba(0,240,255,0.07)" : "rgba(99,102,241,0.07)",
                border: isDark ? "1px solid rgba(0,240,255,0.15)" : "1px solid rgba(99,102,241,0.15)",
                color: accent }}>
              {hint}
            </button>
          ))}
        </div>
      </div>

      {/* Camera Search */}
      <div className="rounded-2xl p-4"
        style={{ background: isDark ? "rgba(255,255,255,0.018)" : "rgba(255,255,255,0.65)",
          border: isDark ? "1px solid rgba(192,132,252,0.20)" : "1px solid rgba(168,85,247,0.18)",
          backdropFilter: "blur(16px)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4" style={{ color: isDark ? "#c084fc" : "#a855f7" }} />
            <span className="text-sm font-bold" style={{ color: textMain }}>البحث بواسطة تصوير الوثيقة</span>
          </div>
          {cameraStep !== "idle" && (
            <button onClick={resetCamera} className="text-xs hover:opacity-70 transition-opacity" style={{ color: textMuted }}>
              إعادة المحاولة
            </button>
          )}
        </div>

        {cameraStep === "idle" && (
          <div className="flex items-center gap-3">
            <p className="text-sm flex-1" style={{ color: textMuted }}>التقط صورة للوثيقة لاستخراج رقمها المرجعي والبحث تلقائياً</p>
            <Button onClick={startCameraSearch} size="sm"
              style={{ background: isDark ? "rgba(192,132,252,0.12)" : "rgba(168,85,247,0.10)",
                border: isDark ? "1px solid rgba(192,132,252,0.35)" : "1px solid rgba(168,85,247,0.30)",
                color: isDark ? "#c084fc" : "#a855f7" }}>
              <Camera className="w-4 h-4 ml-1" /> تصوير
            </Button>
          </div>
        )}

        {cameraStep !== "idle" && cameraStep !== "done" && (
          <div className="space-y-3">
            {([
              { step: "capturing",  label: "جاري تصوير الوثيقة..." },
              { step: "analyzing",  label: "جاري تحليل الوثيقة..." },
              { step: "extracting", label: "جاري استخراج الرقم المرجعي..." },
            ] as { step: CameraStep; label: string }[]).map(({ step, label }) => {
              const stepOrder = ["capturing","analyzing","extracting","done"];
              const currentOrder = stepOrder.indexOf(cameraStep);
              const thisOrder = stepOrder.indexOf(step);
              const done = thisOrder < currentOrder;
              const active = thisOrder === currentOrder;
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: done ? "#10b981" : active ? (isDark ? "rgba(192,132,252,0.20)" : "rgba(168,85,247,0.15)") : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                      border: done ? "none" : active ? `1px solid ${isDark ? "#c084fc" : "#a855f7"}` : isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.10)",
                    }}>
                    {done
                      ? <CheckCircle2 className="w-4 h-4 text-white" />
                      : active
                        ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: isDark ? "#c084fc" : "#a855f7" }} />
                        : <div className="w-2 h-2 rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.20)" }} />
                    }
                  </div>
                  <span className="text-sm" style={{ color: active ? textMain : done ? "#10b981" : textMuted }}>{label}</span>
                </div>
              );
            })}
          </div>
        )}

        {cameraStep === "done" && cameraResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-bold text-emerald-500">تم استخراج الرقم المرجعي بنجاح</span>
            </div>
            <div className="rounded-xl p-3 space-y-2"
              style={{ background: isDark ? "rgba(16,185,129,0.07)" : "rgba(16,185,129,0.06)",
                border: isDark ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(16,185,129,0.20)" }}>
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-emerald-500" />
                <span className="text-xs" style={{ color: textMuted }}>الرقم المرجعي المستخرج</span>
                <span className="font-mono font-bold text-sm text-emerald-500">{cameraResult.refNumber}</span>
              </div>
              <Button size="sm" onClick={() => setLocation("/correspondence")}
                className="w-full gap-2 font-bold text-sm"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "white", boxShadow: "0 4px 14px rgba(16,185,129,0.30)" }}>
                <Mail className="w-4 h-4" /> فتح الخطاب المرتبط
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: textMain }}>نتائج البحث</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: isDark ? "rgba(0,240,255,0.10)" : "rgba(99,102,241,0.10)", color: accent }}>
              {totalResults} نتيجة
            </span>
          </div>

          {totalResults === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: textMuted }}>
              <Search className="w-12 h-12 opacity-25" />
              <p className="font-medium">لم يتم العثور على نتائج لـ "{query}"</p>
            </div>
          )}

          {/* Projects */}
          {results.matchProjects.length > 0 && (
            <ResultSection title="المشاريع" icon={FolderOpen} count={results.matchProjects.length} isDark={isDark} accent={accent}>
              {results.matchProjects.map(p => (
                <ResultRow key={p.id} onClick={() => setLocation(`/projects/${p.id}`)} isDark={isDark} accent={accent}>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs font-bold ml-2" style={{ color: accent }}>{p.number}</span>
                    <span className="text-sm font-semibold" style={{ color: textMain }}>{p.name}</span>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: textMuted }}>{p.client}</span>
                </ResultRow>
              ))}
            </ResultSection>
          )}

          {/* Contracts */}
          {results.matchContracts.length > 0 && (
            <ResultSection title="العقود" icon={FileSignature} count={results.matchContracts.length} isDark={isDark} accent={accent}>
              {results.matchContracts.map(c => {
                const proj = projects.find(p => p.id === c.projectId);
                return (
                  <ResultRow key={c.id} onClick={() => setLocation("/contracts")} isDark={isDark} accent={accent}>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-bold ml-2" style={{ color: accent }}>{c.number}</span>
                      <span className="text-sm font-semibold" style={{ color: textMain }}>{proj?.name ?? c.client}</span>
                    </div>
                    <span className="text-xs shrink-0" style={{ color: textMuted }}>{c.client}</span>
                  </ResultRow>
                );
              })}
            </ResultSection>
          )}

          {/* Letters */}
          {results.matchLetters.length > 0 && (
            <ResultSection title="الخطابات والمراسلات" icon={Mail} count={results.matchLetters.length} isDark={isDark} accent={accent}>
              {results.matchLetters.map(l => (
                <ResultRow key={l.id} onClick={() => setLocation("/correspondence")} isDark={isDark} accent={accent}>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs font-bold ml-2" style={{ color: accent }}>{l.letterNumber}</span>
                    <span className="text-sm font-semibold" style={{ color: textMain }}>{l.name}</span>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: textMuted }}>{l.letterEntity}</span>
                </ResultRow>
              ))}
            </ResultSection>
          )}

          {/* Meetings */}
          {results.matchMeetings.length > 0 && (
            <ResultSection title="الاجتماعات" icon={Calendar} count={results.matchMeetings.length} isDark={isDark} accent={accent}>
              {results.matchMeetings.map(m => (
                <ResultRow key={m.id} onClick={() => setLocation("/meetings")} isDark={isDark} accent={accent}>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs font-bold ml-2" style={{ color: accent }}>{m.number}</span>
                    <span className="text-sm font-semibold" style={{ color: textMain }}>{m.name}</span>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: textMuted }}>
                    {m.meetingDate ? new Date(m.meetingDate).toLocaleDateString("ar-SA") : ""}
                  </span>
                </ResultRow>
              ))}
            </ResultSection>
          )}

          {/* Documents */}
          {results.matchDocs.length > 0 && (
            <ResultSection title="المستندات" icon={FileText} count={results.matchDocs.length} isDark={isDark} accent={accent}>
              {results.matchDocs.map(d => {
                const proj = projects.find(p => p.id === d.projectId);
                return (
                  <ResultRow key={d.id} onClick={() => setLocation(`/projects/${d.projectId}`)} isDark={isDark} accent={accent}>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-bold ml-2" style={{ color: accent }}>{d.number}</span>
                      <span className="text-sm font-semibold" style={{ color: textMain }}>{d.name}</span>
                    </div>
                    <span className="text-xs shrink-0" style={{ color: textMuted }}>{proj?.name ?? "—"}</span>
                  </ResultRow>
                );
              })}
            </ResultSection>
          )}
        </div>
      )}

      {!trimmed && (
        <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: isDark ? "1px dashed rgba(0,240,255,0.12)" : "1px dashed rgba(99,102,241,0.18)" }}>
          <Search className="w-12 h-12 opacity-20" style={{ color: accent }} />
          <div>
            <p className="font-bold text-base mb-1" style={{ color: textMain }}>البحث الموحد</p>
            <p className="text-sm" style={{ color: textMuted }}>
              ابحث برقم المشروع، رقم العقد، رقم الخطاب، الرقم المرجعي، اسم المشروع، أو اسم العميل
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultSection({ title, icon: Icon, count, isDark, accent, children }: {
  title: string; icon: React.ElementType; count: number;
  isDark: boolean; accent: string; children: React.ReactNode;
}) {
  const textMain = isDark ? "rgba(255,255,255,0.92)" : "#1e1b4b";
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: isDark ? "rgba(255,255,255,0.020)" : "rgba(255,255,255,0.68)",
        border: isDark ? "1px solid rgba(0,240,255,0.12)" : "1px solid rgba(99,102,241,0.14)",
        backdropFilter: "blur(14px)" }}>
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: isDark ? "1px solid rgba(0,240,255,0.08)" : "1px solid rgba(99,102,241,0.08)",
          background: isDark ? "rgba(0,240,255,0.03)" : "rgba(99,102,241,0.03)" }}>
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <span className="text-sm font-bold" style={{ color: textMain }}>{title}</span>
        <span className="mr-auto text-xs px-2 py-0.5 rounded-full font-bold"
          style={{ background: isDark ? "rgba(0,240,255,0.10)" : "rgba(99,102,241,0.10)", color: accent }}>
          {count}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}>
        {children}
      </div>
    </div>
  );
}

function ResultRow({ children, onClick, isDark, accent }: {
  children: React.ReactNode; onClick: () => void; isDark: boolean; accent: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="w-full flex items-center gap-3 px-4 py-3 text-right transition-all"
      style={{ background: hov ? (isDark ? "rgba(0,240,255,0.04)" : "rgba(99,102,241,0.04)") : "transparent" }}>
      {children}
      <ArrowLeft className="w-3.5 h-3.5 shrink-0 opacity-40" style={{ color: accent }} />
    </button>
  );
}
