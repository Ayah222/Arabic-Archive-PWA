import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAppContext } from "../context/AppContext";
import { mockLetters } from "../data/mockData";
import {
  Contract, ContractStatus,
  CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS,
} from "../types";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  FileSignature, Plus, Search, X, Save, Trash2,
  Building2, DollarSign, Calendar, FileText,
  Mail, Sparkles, Loader2, ChevronLeft, Clock,
  Link as LinkIcon, ExternalLink,
} from "lucide-react";

let _nextContractId = 4;

function emptyForm() {
  return {
    number: "",
    projectId: "proj_1",
    client: "",
    value: "",
    startDate: "",
    endDate: "",
    durationMonths: "",
    status: "active" as ContractStatus,
    classification: "",
    notes: "",
  };
}

const EXTRACT_TEMPLATES = [
  {
    number: "SPC-2026-0312",
    client: "شركة التطوير العمراني",
    value: "85000000",
    startDate: "2026-03-01",
    endDate: "2028-03-01",
    durationMonths: "24",
    status: "active" as ContractStatus,
    classification: "عقود تطوير عمراني",
    notes: "عقد شامل لأعمال التصميم والإشراف والتنفيذ الكامل",
  },
  {
    number: "GOV-2026-0519",
    client: "وزارة الإسكان",
    value: "220000000",
    startDate: "2026-01-15",
    endDate: "2029-01-15",
    durationMonths: "36",
    status: "active" as ContractStatus,
    classification: "عقود حكومية",
    notes: "مشروع إسكان اجتماعي — المرحلة الثانية",
  },
];

function GlassCard({ children, isDark, accent = "#00f0ff", className = "" }: {
  children: React.ReactNode; isDark: boolean; accent?: string; className?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={`relative rounded-2xl transition-all duration-200 ${className}`}
      style={{
        background: isDark ? "rgba(255,255,255,0.024)" : "rgba(255,255,255,0.72)",
        backdropFilter: "blur(18px) saturate(190%)",
        WebkitBackdropFilter: "blur(18px) saturate(190%)",
        border: hov ? `1px solid ${accent}55` : isDark ? `1px solid ${accent}18` : `1px solid ${accent}22`,
        boxShadow: hov
          ? isDark ? `0 0 18px ${accent}18, 0 8px 28px rgba(0,0,0,0.50)` : `0 0 14px ${accent}12, 0 6px 20px rgba(31,38,135,0.08)`
          : isDark ? "0 4px 14px rgba(0,0,0,0.40)" : "0 2px 8px rgba(31,38,135,0.05)",
      }}
    >
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1, borderRadius:"16px 16px 0 0",
        background: isDark ? `linear-gradient(to right, transparent 10%, ${accent}44 50%, transparent 90%)` : `linear-gradient(to right, transparent 10%, rgba(255,255,255,0.95) 50%, transparent 90%)`,
        pointerEvents:"none" }} />
      {children}
    </div>
  );
}

function StatusBadge({ status, isDark }: { status: ContractStatus; isDark: boolean }) {
  const col = CONTRACT_STATUS_COLORS[status];
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
      style={{ background: isDark ? col.darkBg : col.bg, color: isDark ? col.darkText : col.text }}>
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}

export default function Contracts() {
  const { contracts, addContract, deleteContract, theme, projects } = useAppContext();
  const isDark = theme === "dark";
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [selected, setSelected] = useState<Contract | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...contracts];
    if (statusFilter !== "all") list = list.filter(c => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.number.toLowerCase().includes(q) ||
        c.client.toLowerCase().includes(q) ||
        c.classification.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [contracts, search, statusFilter]);

  const relatedLetters = useMemo(() =>
    selected ? mockLetters.filter(l => l.contractId === selected.id) : [],
    [selected]
  );

  const selectedProject = useMemo(() =>
    selected ? projects.find(p => p.id === selected.projectId) ?? null : null,
    [selected, projects]
  );

  const handleAutoExtract = () => {
    setExtracting(true);
    setTimeout(() => {
      const tpl = EXTRACT_TEMPLATES[Math.floor(Math.random() * EXTRACT_TEMPLATES.length)];
      setForm(prev => ({ ...prev, ...tpl }));
      setExtracting(false);
    }, 1800);
  };

  const handleSave = () => {
    if (!form.number.trim() || !form.client.trim()) return;
    const newContract: Contract = {
      id: `contract_${_nextContractId++}`,
      number: form.number,
      projectId: form.projectId,
      client: form.client,
      value: parseFloat(form.value) || 0,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : new Date().toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : new Date().toISOString(),
      durationMonths: parseInt(form.durationMonths) || 12,
      status: form.status,
      classification: form.classification,
      notes: form.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addContract(newContract);
    setForm(emptyForm());
    setAddOpen(false);
  };

  const accent = isDark ? "#00f0ff" : "#6366f1";
  const textMain = isDark ? "rgba(255,255,255,0.92)" : "#1e1b4b";
  const textMuted = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const labelColor = isDark ? "rgba(0,240,255,0.65)" : "#6366f1";

  const fieldCls = "w-full rounded-xl px-3 py-2 text-sm border outline-none transition-all focus:ring-2 bg-transparent";
  const fieldStyle = {
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
    border: isDark ? "1px solid rgba(0,240,255,0.18)" : "1px solid rgba(99,102,241,0.25)",
    color: isDark ? "#e2e8f0" : "#1e293b",
  } as React.CSSProperties;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: isDark ? "rgba(0,240,255,0.10)" : "rgba(99,102,241,0.10)",
              border: isDark ? "1px solid rgba(0,240,255,0.25)" : "1px solid rgba(99,102,241,0.25)" }}>
            <FileSignature className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: textMain }}>العقود</h1>
            <p className="text-sm" style={{ color: textMuted }}>إدارة عقود المشاريع ومتابعتها</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setAddOpen(true); setForm(emptyForm()); }}
            className="gap-2 text-sm font-bold"
            style={{ background: isDark ? "linear-gradient(135deg,#00f0ff22,#7000ff22)" : "linear-gradient(135deg,#6366f122,#a855f722)",
              border: isDark ? "1px solid rgba(0,240,255,0.45)" : "1px solid rgba(99,102,241,0.45)",
              color: accent, boxShadow: isDark ? "0 0 14px rgba(0,240,255,0.18)" : "none" }}>
            <Plus className="w-4 h-4" /> إضافة عقد
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 pointer-events-none" style={{ color: textMuted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم العقد أو العميل..."
            className="w-full rounded-xl pr-9 pl-3 py-2 text-sm border outline-none transition-all"
            style={{ ...fieldStyle }} />
        </div>
        {(["all","active","completed","terminated","draft"] as (ContractStatus|"all")[]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={statusFilter === s
              ? { background: isDark ? "rgba(0,240,255,0.12)" : "rgba(99,102,241,0.12)", color: accent, border: `1px solid ${accent}44` }
              : { color: textMuted, border: "1px solid transparent" }}>
            {s === "all" ? "الكل" : CONTRACT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contracts List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: textMuted }}>
              <FileSignature className="w-12 h-12 opacity-30" />
              <p className="font-medium">لا توجد عقود</p>
            </div>
          ) : filtered.map(contract => {
            const proj = projects.find(p => p.id === contract.projectId);
            const isSelected = selected?.id === contract.id;
            return (
              <div key={contract.id}
                onClick={() => setSelected(isSelected ? null : contract)}
                className="cursor-pointer rounded-2xl p-4 transition-all duration-200"
                style={{
                  background: isSelected
                    ? isDark ? "rgba(0,240,255,0.06)" : "rgba(99,102,241,0.06)"
                    : isDark ? "rgba(255,255,255,0.024)" : "rgba(255,255,255,0.72)",
                  border: isSelected
                    ? `1px solid ${accent}55`
                    : isDark ? "1px solid rgba(0,240,255,0.12)" : "1px solid rgba(99,102,241,0.15)",
                  boxShadow: isSelected ? (isDark ? `0 0 18px ${accent}15` : `0 4px 16px rgba(99,102,241,0.12)`) : "none",
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold" style={{ color: accent }}>{contract.number}</span>
                      <StatusBadge status={contract.status} isDark={isDark} />
                    </div>
                    <p className="font-bold text-sm truncate mb-1" style={{ color: textMain }}>
                      {proj?.name ?? "—"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: textMuted }}>
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contract.client}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{contract.value.toLocaleString("ar-SA")} ﷼</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{contract.durationMonths} شهر</span>
                    </div>
                    {contract.classification && (
                      <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-md"
                        style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", color: textMuted }}>
                        {contract.classification}
                      </span>
                    )}
                  </div>
                  <button onClick={e => { e.stopPropagation(); setDeleteTarget(contract.id); }}
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-destructive hover:bg-destructive/10"
                    style={{ opacity: 0.6 }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: textMuted }}>
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(contract.startDate).toLocaleDateString("ar-SA")}</span>
                  <span>←</span>
                  <span>{new Date(contract.endDate).toLocaleDateString("ar-SA")}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        {selected ? (
          <GlassCard isDark={isDark} accent={accent}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base" style={{ color: textMain }}>تفاصيل العقد</h2>
                <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                  <X className="w-4 h-4" style={{ color: textMuted }} />
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold" style={{ color: labelColor }}>رقم العقد</p>
                <p className="font-mono font-bold text-lg" style={{ color: accent }}>{selected.number}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: labelColor }}>العميل</p>
                  <p className="text-sm font-bold" style={{ color: textMain }}>{selected.client}</p>
                </div>
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: labelColor }}>الحالة</p>
                  <StatusBadge status={selected.status} isDark={isDark} />
                </div>
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: labelColor }}>قيمة العقد</p>
                  <p className="text-sm font-bold" style={{ color: textMain }}>{selected.value.toLocaleString("ar-SA")} ريال</p>
                </div>
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: labelColor }}>المدة</p>
                  <p className="text-sm font-bold" style={{ color: textMain }}>{selected.durationMonths} شهر</p>
                </div>
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: labelColor }}>تاريخ البداية</p>
                  <p className="text-sm" style={{ color: textMain }}>{new Date(selected.startDate).toLocaleDateString("ar-SA")}</p>
                </div>
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: labelColor }}>تاريخ الانتهاء</p>
                  <p className="text-sm" style={{ color: textMain }}>{new Date(selected.endDate).toLocaleDateString("ar-SA")}</p>
                </div>
                {selected.classification && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold mb-0.5" style={{ color: labelColor }}>التصنيف</p>
                    <p className="text-sm" style={{ color: textMain }}>{selected.classification}</p>
                  </div>
                )}
              </div>

              {/* Linked Project */}
              {selectedProject && (
                <div className="rounded-xl p-3" style={{ background: isDark ? "rgba(0,240,255,0.05)" : "rgba(99,102,241,0.05)", border: isDark ? "1px solid rgba(0,240,255,0.15)" : "1px solid rgba(99,102,241,0.15)" }}>
                  <p className="text-xs font-bold mb-2" style={{ color: labelColor }}>المشروع المرتبط</p>
                  <button onClick={() => setLocation(`/projects/${selectedProject.id}`)}
                    className="flex items-center gap-2 w-full text-right hover:opacity-75 transition-opacity">
                    <Building2 className="w-4 h-4 shrink-0" style={{ color: accent }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: textMain }}>{selectedProject.name}</p>
                      <p className="text-xs" style={{ color: textMuted }}>{selectedProject.number} · {selectedProject.client}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
                  </button>
                </div>
              )}

              {/* Linked Letters */}
              {relatedLetters.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: labelColor }}>الخطابات المرتبطة ({relatedLetters.length})</p>
                  <div className="space-y-2">
                    {relatedLetters.map(letter => (
                      <button key={letter.id}
                        onClick={() => setLocation("/correspondence")}
                        className="w-full flex items-center gap-2 p-2.5 rounded-lg text-right hover:opacity-80 transition-opacity"
                        style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)" }}>
                        <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: textMain }}>{letter.name}</p>
                          <p className="text-xs" style={{ color: textMuted }}>{letter.letterNumber} · {letter.letterEntity}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selected.notes && (
                <div>
                  <p className="text-xs font-bold mb-1" style={{ color: labelColor }}>ملاحظات</p>
                  <p className="text-sm leading-relaxed" style={{ color: textMain }}>{selected.notes}</p>
                </div>
              )}
            </div>
          </GlassCard>
        ) : (
          <div className="rounded-2xl flex flex-col items-center justify-center gap-3 min-h-64"
            style={{ border: isDark ? "1px dashed rgba(0,240,255,0.15)" : "1px dashed rgba(99,102,241,0.20)" }}>
            <FileSignature className="w-10 h-10 opacity-25" style={{ color: accent }} />
            <p className="text-sm" style={{ color: textMuted }}>اختر عقداً لعرض تفاصيله</p>
          </div>
        )}
      </div>

      {/* ═══ Add Contract Modal ═══ */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={e => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div className="w-full max-w-2xl rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{ background: isDark ? "#0c0a1a" : "#f8faff",
              border: isDark ? "1px solid rgba(0,240,255,0.20)" : "1px solid rgba(99,102,241,0.25)",
              boxShadow: isDark ? "0 0 60px rgba(0,240,255,0.12), 0 24px 80px rgba(0,0,0,0.80)" : "0 24px 80px rgba(99,102,241,0.15)" }}>

            {/* Modal header */}
            <div className="p-5 flex items-center justify-between"
              style={{ borderBottom: isDark ? "1px solid rgba(0,240,255,0.10)" : "1px solid rgba(99,102,241,0.10)" }}>
              <div className="flex items-center gap-3">
                <FileSignature className="w-5 h-5" style={{ color: accent }} />
                <h2 className="font-bold text-base" style={{ color: textMain }}>إضافة عقد جديد</h2>
              </div>
              <button onClick={() => setAddOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
                <X className="w-4 h-4" style={{ color: textMuted }} />
              </button>
            </div>

            {/* Auto-extract button */}
            <div className="px-5 pt-4">
              <button onClick={handleAutoExtract} disabled={extracting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: isDark ? "rgba(0,240,255,0.07)" : "rgba(99,102,241,0.07)",
                  border: isDark ? "1px solid rgba(0,240,255,0.25)" : "1px solid rgba(99,102,241,0.25)",
                  color: accent,
                  boxShadow: extracting ? (isDark ? "0 0 16px rgba(0,240,255,0.22)" : "0 0 12px rgba(99,102,241,0.18)") : "none",
                }}>
                {extracting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> جاري تحليل الوثيقة...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> استخراج البيانات تلقائياً</>
                )}
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>رقم العقد *</label>
                  <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                    placeholder="مثال: MOH-2026-0041" className={fieldCls} style={fieldStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>المشروع</label>
                  <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                    className={fieldCls} style={fieldStyle}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>العميل *</label>
                  <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                    placeholder="اسم الجهة أو العميل" className={fieldCls} style={fieldStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>قيمة العقد (ريال)</label>
                  <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="0" className={fieldCls} style={fieldStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>مدة العقد (شهر)</label>
                  <input type="number" value={form.durationMonths} onChange={e => setForm(f => ({ ...f, durationMonths: e.target.value }))}
                    placeholder="12" className={fieldCls} style={fieldStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>تاريخ البداية</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className={fieldCls} style={fieldStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>تاريخ الانتهاء</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className={fieldCls} style={fieldStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>حالة العقد</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))}
                    className={fieldCls} style={fieldStyle}>
                    {(Object.entries(CONTRACT_STATUS_LABELS) as [ContractStatus, string][]).map(([k, v]) =>
                      <option key={k} value={k}>{v}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>التصنيف</label>
                  <input value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))}
                    placeholder="اكتب أي تصنيف" className={fieldCls} style={fieldStyle} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: labelColor }}>ملاحظات</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} placeholder="أي ملاحظات إضافية..."
                    className={fieldCls} style={{ ...fieldStyle, resize: "none" as const }} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} className="flex-1 gap-2 font-bold"
                  style={{ background: isDark ? "linear-gradient(135deg,#00f0ff,#7000ff)" : "linear-gradient(135deg,#6366f1,#a855f7)",
                    color: "white", boxShadow: isDark ? "0 0 20px rgba(0,240,255,0.30)" : "0 4px 16px rgba(99,102,241,0.40)" }}>
                  <Save className="w-4 h-4" /> حفظ العقد
                </Button>
                <Button variant="outline" onClick={() => setAddOpen(false)} className="gap-2">
                  <X className="w-4 h-4" /> إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: isDark ? "#0c0a1a" : "#f8faff",
              border: isDark ? "1px solid rgba(239,68,68,0.30)" : "1px solid rgba(239,68,68,0.25)" }}>
            <h3 className="font-bold text-base" style={{ color: textMain }}>حذف العقد؟</h3>
            <p className="text-sm" style={{ color: textMuted }}>سيتم حذف هذا العقد بشكل نهائي.</p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => { deleteContract(deleteTarget); setDeleteTarget(null); if (selected?.id === deleteTarget) setSelected(null); }}
                className="flex-1">تأكيد الحذف</Button>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">إلغاء</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
