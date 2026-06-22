import React, { useState, useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { mockMeetings, mockProjects } from "../data/mockData";
import { Document } from "../types";
import {
  CalendarCheck, Plus, X, Save, Trash2, ChevronDown, ChevronUp,
  Users, CheckSquare, ClipboardList, MapPin,
} from "lucide-react";
import { Button } from "../components/ui/button";

// ─── Local mock store ─────────────────────────────────────────────────────────

let _meetings: Document[] = [...mockMeetings];
let _nextId = 5;

function useMeetingsStore() {
  const [meetings, setMeetings] = useState<Document[]>(_meetings);
  const add = (m: Document) => { _meetings = [m, ..._meetings]; setMeetings([..._meetings]); };
  const remove = (id: string) => { _meetings = _meetings.filter((m) => m.id !== id); setMeetings([..._meetings]); };
  return { meetings, add, remove };
}

// ─── Empty form ───────────────────────────────────────────────────────────────

function emptyForm() {
  return {
    name: "",
    projectId: "proj_1",
    meetingDate: new Date().toISOString().slice(0, 10),
    meetingLocation: "",
    attendeesText: "",
    decisionsText: "",
    tasksText: "",
  };
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────

function MeetingCard({ m, isDark, onDelete }: { m: Document; isDark: boolean; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const proj = mockProjects.find((p) => p.id === m.projectId);

  const title  = isDark ? "rgba(255,255,255,0.92)" : "#1e1b4b";
  const muted  = isDark ? "rgba(255,255,255,0.42)" : "#6b7280";
  const body   = isDark ? "rgba(255,255,255,0.78)" : "#374151";
  const accent = isDark ? "#c084fc" : "#7c3aed";
  const bg     = isDark ? "rgba(255,255,255,0.024)" : "rgba(255,255,255,0.72)";
  const brd    = isDark ? "1px solid rgba(192,132,252,0.12)" : "1px solid rgba(124,58,237,0.13)";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: bg, border: brd }}>
      {/* Card Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: isDark ? "rgba(192,132,252,0.12)" : "rgba(124,58,237,0.08)", border: `1px solid ${accent}30` }}>
          <CalendarCheck className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: title }}>{m.name}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {proj && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: isDark ? "rgba(0,240,255,0.08)" : "rgba(99,102,241,0.08)", color: isDark ? "#00f0ff" : "#6366f1", border: isDark ? "1px solid rgba(0,240,255,0.15)" : "1px solid rgba(99,102,241,0.15)" }}>
                {proj.name}
              </span>
            )}
            <span className="text-xs font-mono" style={{ color: muted }}>
              {m.meetingDate ? new Date(m.meetingDate).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }) : "—"}
            </span>
          </div>
          {m.meetingLocation && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 shrink-0" style={{ color: muted }} />
              <span className="text-xs truncate" style={{ color: muted }}>{m.meetingLocation}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setExpanded((v) => !v)}
            className="w-7 h-7 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
            style={{ background: isDark ? "rgba(192,132,252,0.10)" : "rgba(124,58,237,0.08)", border: `1px solid ${accent}25`, color: accent }}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onDelete}
            className="w-7 h-7 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
            style={{ background: isDark ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#f87171" }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3"
          style={{ borderTop: isDark ? "1px solid rgba(192,132,252,0.08)" : "1px solid rgba(124,58,237,0.08)" }}>

          {/* الحضور */}
          {m.attendees && m.attendees.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5" style={{ color: accent }} />
                <span className="text-xs font-bold" style={{ color: accent }}>الحضور</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {m.attendees.map((a, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: isDark ? "rgba(192,132,252,0.08)" : "rgba(124,58,237,0.06)", color: body, border: isDark ? "1px solid rgba(192,132,252,0.15)" : "1px solid rgba(124,58,237,0.12)" }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* القرارات */}
          {m.decisions && m.decisions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckSquare className="w-3.5 h-3.5" style={{ color: isDark ? "#34d399" : "#059669" }} />
                <span className="text-xs font-bold" style={{ color: isDark ? "#34d399" : "#059669" }}>القرارات</span>
              </div>
              <ul className="space-y-1">
                {m.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: body }}>
                    <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: isDark ? "rgba(52,211,153,0.12)" : "rgba(5,150,105,0.08)", color: isDark ? "#34d399" : "#059669", fontSize: 9 }}>{i + 1}</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* المهام */}
          {m.tasks && m.tasks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ClipboardList className="w-3.5 h-3.5" style={{ color: isDark ? "#fbbf24" : "#d97706" }} />
                <span className="text-xs font-bold" style={{ color: isDark ? "#fbbf24" : "#d97706" }}>المهام</span>
              </div>
              <ul className="space-y-1">
                {m.tasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: body }}>
                    <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full mt-1.5"
                      style={{ background: isDark ? "#fbbf24" : "#d97706" }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Meetings() {
  const { theme } = useAppContext();
  const isDark = theme === "dark";
  const { meetings, add, remove } = useMeetingsStore();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const title = isDark ? "rgba(255,255,255,0.92)" : "#1e1b4b";
  const muted = isDark ? "rgba(255,255,255,0.42)" : "#6b7280";
  const accent = isDark ? "#c084fc" : "#7c3aed";

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 10,
    border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(99,102,241,0.22)",
    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.80)",
    color: isDark ? "#e2e8f0" : "#1e293b", fontSize: 13,
    outline: "none", fontFamily: "inherit",
  };
  const ta: React.CSSProperties = { ...inp, resize: "vertical", minHeight: 72 };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.meetingDate) return;
    const newMeeting: Document = {
      id: `meet_${_nextId++}`,
      number: `DOC-MTG-${String(_nextId).padStart(3, "0")}`,
      name: form.name.trim(),
      type: "meeting",
      projectId: form.projectId,
      createdAt: new Date(form.meetingDate).toISOString(),
      meetingDate: new Date(form.meetingDate).toISOString(),
      meetingLocation: form.meetingLocation.trim() || undefined,
      attendees: form.attendeesText ? form.attendeesText.split("\n").map((s) => s.trim()).filter(Boolean) : [],
      decisions: form.decisionsText ? form.decisionsText.split("\n").map((s) => s.trim()).filter(Boolean) : [],
      tasks: form.tasksText ? form.tasksText.split("\n").map((s) => s.trim()).filter(Boolean) : [],
    };
    add(newMeeting);
    setForm(emptyForm());
    setShowAdd(false);
  };

  const sorted = useMemo(() =>
    [...meetings].sort((a, b) =>
      new Date(b.meetingDate || b.createdAt).getTime() - new Date(a.meetingDate || a.createdAt).getTime()
    ), [meetings]);

  return (
    <div className="space-y-5 p-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black" style={{ color: title }}>إدارة الاجتماعات</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>تسجيل الاجتماعات مع الحضور والقرارات والمهام</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: isDark ? "rgba(192,132,252,0.12)" : "rgba(124,58,237,0.08)", color: accent, border: `1px solid ${accent}30` }}>
            {meetings.length} اجتماع
          </span>
          <Button
            onClick={() => setShowAdd(true)}
            className="gap-2 rounded-xl text-sm font-bold h-9 px-4"
            style={{ background: isDark ? "linear-gradient(135deg,#c084fc,#818cf8)" : "linear-gradient(135deg,#7c3aed,#6366f1)", color: "#fff", border: "none" }}>
            <Plus className="w-4 h-4" /> إضافة اجتماع
          </Button>
        </div>
      </div>

      {/* ── Meetings Grid ── */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl py-20 text-center"
          style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.60)", border: isDark ? "1px solid rgba(192,132,252,0.08)" : "1px solid rgba(124,58,237,0.08)" }}>
          <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-25" style={{ color: accent }} />
          <p style={{ color: muted }}>لا توجد اجتماعات مسجلة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((m) => (
            <MeetingCard key={m.id} m={m} isDark={isDark} onDelete={() => setDeleteId(m.id)} />
          ))}
        </div>
      )}

      {/* ── Add Dialog ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto"
            style={{ background: isDark ? "rgba(15,10,30,0.95)" : "rgba(255,255,255,0.97)", border: isDark ? "1px solid rgba(192,132,252,0.20)" : "1px solid rgba(124,58,237,0.20)", boxShadow: "0 30px 80px rgba(0,0,0,0.70)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black" style={{ color: title }}>إضافة اجتماع جديد</h2>
              <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded-xl flex items-center justify-center hover:opacity-70" style={{ color: muted }}><X className="w-4 h-4" /></button>
            </div>

            {/* عنوان الاجتماع */}
            <div>
              <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>عنوان الاجتماع *</label>
              <input style={inp} placeholder="مثال: اجتماع متابعة التنفيذ الأسبوعي" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* التاريخ */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>تاريخ الاجتماع *</label>
                <input type="date" style={inp} value={form.meetingDate} onChange={(e) => setForm((f) => ({ ...f, meetingDate: e.target.value }))} />
              </div>
              {/* المشروع */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>المشروع</label>
                <select style={inp} value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                  {mockProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {/* موقع الاجتماع */}
            <div>
              <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>موقع الاجتماع</label>
              <input style={inp} placeholder="مثال: قاعة الاجتماعات — مكتب جدة" value={form.meetingLocation} onChange={(e) => setForm((f) => ({ ...f, meetingLocation: e.target.value }))} />
            </div>

            {/* الحضور */}
            <div>
              <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>الحضور (سطر لكل شخص)</label>
              <textarea style={ta} placeholder={"م. أحمد العمري\nأ. سارة الشهري\nم. فهد الزهراني"} value={form.attendeesText} onChange={(e) => setForm((f) => ({ ...f, attendeesText: e.target.value }))} />
            </div>

            {/* القرارات */}
            <div>
              <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>القرارات (سطر لكل قرار)</label>
              <textarea style={ta} placeholder={"الموافقة على جدول التنفيذ\nتعيين مشرف ميداني"} value={form.decisionsText} onChange={(e) => setForm((f) => ({ ...f, decisionsText: e.target.value }))} />
            </div>

            {/* المهام */}
            <div>
              <label className="text-xs font-bold mb-1 block" style={{ color: muted }}>المهام (سطر لكل مهمة)</label>
              <textarea style={ta} placeholder={"رفع المخططات للاعتماد\nإعداد تقرير التقدم"} value={form.tasksText} onChange={(e) => setForm((f) => ({ ...f, tasksText: e.target.value }))} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSubmit} className="flex-1 gap-2 rounded-xl text-sm font-bold h-9"
                style={{ background: isDark ? "linear-gradient(135deg,#c084fc,#818cf8)" : "linear-gradient(135deg,#7c3aed,#6366f1)", color: "#fff", border: "none" }}>
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
            <p className="font-bold" style={{ color: title }}>تأكيد حذف الاجتماع</p>
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
