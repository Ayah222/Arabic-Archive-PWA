import React, { useState, useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { mockLetters, mockProjects } from "../data/mockData";
import { Document } from "../types";
import {
  Mail, ArrowUpRight, ArrowDownLeft, FileCheck,
  Plus, Search, X, Save, Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type LetterClass = "all" | "outgoing" | "incoming" | "meeting_minutes";

const CLASS_CONFIG: Record<string, { label: string; color: string; darkColor: string; Icon: React.FC<any> }> = {
  outgoing:        { label: "صادر",         color: "#0ea5e9", darkColor: "#38bdf8", Icon: ArrowUpRight },
  incoming:        { label: "وارد",          color: "#a855f7", darkColor: "#c084fc", Icon: ArrowDownLeft },
  meeting_minutes: { label: "محضر اجتماع",  color: "#10b981", darkColor: "#34d399", Icon: FileCheck },
};

// ─── Local mock store (writable) ─────────────────────────────────────────────

let _letters: Document[] = [...mockLetters];
let _nextId = 9;

function useLetters() {
  const [letters, setLetters] = useState<Document[]>(_letters);

  const add = (letter: Document) => {
    _letters = [letter, ..._letters];
    setLetters([..._letters]);
  };

  const remove = (id: string) => {
    _letters = _letters.filter((l) => l.id !== id);
    setLetters([..._letters]);
  };

  return { letters, add, remove };
}

// ─── Empty form ───────────────────────────────────────────────────────────────

function emptyForm() {
  return {
    letterClassification: "outgoing" as "outgoing" | "incoming" | "meeting_minutes",
    letterNumber: "",
    letterEntity: "",
    letterSubject: "",
    name: "",
    projectId: "proj_1",
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Correspondence() {
  const { theme } = useAppContext();
  const isDark = theme === "dark";
  const { letters, add, remove } = useLetters();

  const [filter, setFilter] = useState<LetterClass>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const visible = useMemo(() => {
    let list = filter === "all" ? letters : letters.filter((l) => l.letterClassification === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        (l.letterEntity || "").toLowerCase().includes(q) ||
        (l.letterSubject || "").toLowerCase().includes(q) ||
        (l.letterNumber || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [letters, filter, search]);

  const counts = useMemo(() => ({
    all:             letters.length,
    outgoing:        letters.filter((l) => l.letterClassification === "outgoing").length,
    incoming:        letters.filter((l) => l.letterClassification === "incoming").length,
    meeting_minutes: letters.filter((l) => l.letterClassification === "meeting_minutes").length,
  }), [letters]);

  /* ── Styles ── */
  const bg    = isDark ? "rgba(255,255,255,0.024)" : "rgba(255,255,255,0.72)";
  const brd   = isDark ? "1px solid rgba(0,240,255,0.09)" : "1px solid rgba(99,102,241,0.13)";
  const title = isDark ? "rgba(255,255,255,0.92)" : "#1e1b4b";
  const muted = isDark ? "rgba(255,255,255,0.42)" : "#6b7280";
  const body  = isDark ? "rgba(255,255,255,0.78)" : "#374151";

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 10,
    border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(99,102,241,0.22)",
    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.80)",
    color: isDark ? "#e2e8f0" : "#1e293b", fontSize: 13,
    outline: "none", fontFamily: "inherit",
  };

  const handleSubmit = () => {
    if (!form.letterNumber.trim() || !form.letterEntity.trim() || !form.letterSubject.trim()) return;
    const newDoc: Document = {
      id: `let_${_nextId++}`,
      number: `DOC-LET-${String(_nextId).padStart(3, "0")}`,
      name: form.name.trim() || form.letterSubject.trim(),
      type: "letter",
      projectId: form.projectId,
      createdAt: new Date(form.createdAt).toISOString(),
      letterClassification: form.letterClassification,
      letterNumber: form.letterNumber.trim(),
      letterEntity: form.letterEntity.trim(),
      letterSubject: form.letterSubject.trim(),
    };
    add(newDoc);
    setForm(emptyForm());
    setShowAdd(false);
  };

  return (
    <div className="space-y-5 p-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black" style={{ color: title }}>الخطابات والمراسلات</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>إدارة الخطابات الصادرة والواردة ومحاضر الاجتماعات</p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="gap-2 rounded-xl text-sm font-bold h-9 px-4"
          style={{ background: isDark ? "linear-gradient(135deg,#00f0ff,#818cf8)" : "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", border: "none" }}>
          <Plus className="w-4 h-4" /> إضافة خطاب
        </Button>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {(["all", "outgoing", "incoming", "meeting_minutes"] as LetterClass[]).map((cls) => {
          const active = filter === cls;
          const cfg = cls === "all" ? null : CLASS_CONFIG[cls];
          const col = cfg ? (isDark ? cfg.darkColor : cfg.color) : (isDark ? "#00f0ff" : "#6366f1");
          return (
            <button
              key={cls}
              onClick={() => setFilter(cls)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: active ? (isDark ? `${col}22` : `${col}18`) : (isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.60)"),
                border: active ? `1px solid ${col}80` : (isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(99,102,241,0.12)"),
                color: active ? col : muted,
                boxShadow: active ? `0 0 12px ${col}20` : "none",
              }}>
              {cfg && <cfg.Icon className="w-3 h-3" />}
              {cls === "all" ? "الكل" : cfg?.label}
              <span className="px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: active ? `${col}28` : (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"), color: active ? col : muted }}>
                {counts[cls]}
              </span>
            </button>
          );
        })}

        {/* Search */}
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: muted }} />
          <input
            placeholder="بحث…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inp, paddingRight: 32, height: 34 }}
          />
        </div>
      </div>

      {/* ── Letters Table ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: bg, border: brd }}>
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_1.8fr_1.8fr_1.1fr_auto] gap-3 px-4 py-2.5 text-xs font-bold"
          style={{ color: muted, borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(99,102,241,0.08)", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(99,102,241,0.03)" }}>
          <span>رقم الخطاب</span>
          <span>الجهة</span>
          <span>الموضوع</span>
          <span>التاريخ</span>
          <span>حذف</span>
        </div>

        {/* Rows */}
        {visible.length === 0 ? (
          <div className="py-16 text-center" style={{ color: muted }}>
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد خطابات</p>
          </div>
        ) : (
          visible.map((l, i) => {
            const cls = l.letterClassification || "outgoing";
            const cfg = CLASS_CONFIG[cls];
            const col = isDark ? cfg.darkColor : cfg.color;
            return (
              <div
                key={l.id}
                className="grid grid-cols-[1fr_1.8fr_1.8fr_1.1fr_auto] gap-3 px-4 py-3 items-center"
                style={{ borderBottom: i < visible.length - 1 ? (isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(99,102,241,0.07)") : "none" }}>

                {/* رقم الخطاب + نوع */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${col}18`, border: `1px solid ${col}30` }}>
                      <cfg.Icon className="w-3 h-3" style={{ color: col }} />
                    </div>
                    <span className="text-xs font-bold font-mono" style={{ color: col }}>{l.letterNumber || l.number}</span>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded-md self-start"
                    style={{ background: `${col}14`, color: col, fontSize: 10 }}>{cfg.label}</span>
                </div>

                {/* الجهة */}
                <span className="text-xs font-medium truncate" style={{ color: body }}>{l.letterEntity || "—"}</span>

                {/* الموضوع */}
                <span className="text-xs truncate" style={{ color: muted }}>{l.letterSubject || l.name}</span>

                {/* التاريخ */}
                <span className="text-xs font-mono tabular-nums" style={{ color: muted }}>
                  {new Date(l.createdAt).toLocaleDateString("ar-SA")}
                </span>

                {/* Delete */}
                <button
                  onClick={() => setDeleteId(l.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                  style={{ background: isDark ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#f87171" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Add Dialog ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4"
            style={{ background: isDark ? "rgba(15,10,30,0.95)" : "rgba(255,255,255,0.97)", border: isDark ? "1px solid rgba(0,240,255,0.15)" : "1px solid rgba(99,102,241,0.20)", boxShadow: isDark ? "0 30px 80px rgba(0,0,0,0.80)" : "0 20px 60px rgba(99,102,241,0.14)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black" style={{ color: title }}>إضافة خطاب جديد</h2>
              <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded-xl flex items-center justify-center hover:opacity-70" style={{ color: muted }}><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              {/* نوع الخطاب */}
              <div>
                <label className="text-xs font-bold mb-1.5 block" style={{ color: muted }}>نوع الخطاب</label>
                <div className="flex gap-2">
                  {(["outgoing", "incoming", "meeting_minutes"] as const).map((cls) => {
                    const cfg = CLASS_CONFIG[cls];
                    const col = isDark ? cfg.darkColor : cfg.color;
                    const active = form.letterClassification === cls;
                    return (
                      <button key={cls}
                        onClick={() => setForm((f) => ({ ...f, letterClassification: cls }))}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: active ? `${col}20` : (isDark ? "rgba(255,255,255,0.04)" : "rgba(99,102,241,0.04)"),
                          border: active ? `1px solid ${col}70` : (isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(99,102,241,0.10)"),
                          color: active ? col : muted,
                        }}>
                        <cfg.Icon className="w-3 h-3" />{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* رقم الخطاب */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>رقم الخطاب *</label>
                <input style={inp} placeholder="مثال: خ/2026/005" value={form.letterNumber} onChange={(e) => setForm((f) => ({ ...f, letterNumber: e.target.value }))} />
              </div>

              {/* الجهة */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>الجهة *</label>
                <input style={inp} placeholder="اسم الجهة المرسِلة أو المستلِمة" value={form.letterEntity} onChange={(e) => setForm((f) => ({ ...f, letterEntity: e.target.value }))} />
              </div>

              {/* الموضوع */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>الموضوع *</label>
                <input style={inp} placeholder="موضوع الخطاب" value={form.letterSubject} onChange={(e) => setForm((f) => ({ ...f, letterSubject: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* التاريخ */}
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>التاريخ</label>
                  <input type="date" style={inp} value={form.createdAt} onChange={(e) => setForm((f) => ({ ...f, createdAt: e.target.value }))} />
                </div>
                {/* المشروع */}
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>المشروع</label>
                  <select style={inp} value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                    {mockProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSubmit} className="flex-1 gap-2 rounded-xl text-sm font-bold h-9"
                style={{ background: isDark ? "linear-gradient(135deg,#00f0ff,#818cf8)" : "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", border: "none" }}>
                <Save className="w-4 h-4" /> حفظ
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)} className="rounded-xl h-9 px-4" style={{ color: muted }}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 text-center"
            style={{ background: isDark ? "rgba(15,10,30,0.95)" : "#fff", border: isDark ? "1px solid rgba(239,68,68,0.20)" : "1px solid rgba(239,68,68,0.15)" }}>
            <Trash2 className="w-8 h-8 mx-auto" style={{ color: "#f87171" }} />
            <p className="font-bold" style={{ color: title }}>تأكيد حذف الخطاب</p>
            <p className="text-sm" style={{ color: muted }}>هل تريد حذف هذا الخطاب نهائياً؟</p>
            <div className="flex gap-2">
              <button onClick={() => { remove(deleteId); setDeleteId(null); }}
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.30)" }}>حذف</button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", color: muted, border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.08)" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
