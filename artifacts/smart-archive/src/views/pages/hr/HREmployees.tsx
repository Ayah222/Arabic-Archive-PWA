import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, X, User, Phone, Mail, Briefcase } from "lucide-react";
import { useEmployees, useCreateEmployee } from "../../../controllers/useHr";
import EmptyState from "../../components/shared/EmptyState";
import { getArchivePermissions } from "../../../controllers/permissions";

const inputCls = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm";
const addBtnStyle = {
  background: "linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)",
  color: "#fff",
  boxShadow: "0 0 20px rgba(0,240,255,0.30)",
};

const STATUS_LABEL: Record<string, string> = {
  active: "نشط", on_leave: "في إجازة", terminated: "منتهي الخدمة",
};
const STATUS_COLOR: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  on_leave: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  terminated: "text-red-400 bg-red-400/10 border-red-400/25",
};

function AddEmployeeModal({ onClose }: { onClose: () => void }) {
  const create = useCreateEmployee();
  const [form, setForm] = useState({
    name: "", nationalId: "", position: "", department: "", phone: "", email: "",
    hireDate: "", employmentType: "full_time", probationDays: "90", notes: "",
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    await create.mutateAsync({
      name: form.name.trim(),
      nationalId: form.nationalId || null,
      position: form.position || null,
      department: form.department || null,
      phone: form.phone || null,
      email: form.email || null,
      hireDate: form.hireDate || null,
      employmentType: form.employmentType as any,
      status: "active",
      probationDays: Number(form.probationDays) || 90,
      notes: form.notes || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 relative max-h-[90vh] overflow-y-auto" style={{ background: "rgba(12,10,25,0.97)" }}>
        <button onClick={onClose} className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        <h2 className="font-bold text-lg mb-4 text-center">إضافة موظف</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">الاسم الكامل *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم الموظف" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">المسمى الوظيفي</label>
              <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">القسم</label>
              <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">الهاتف</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">رقم الهوية / الإقامة</label>
            <input value={form.nationalId} onChange={e => setForm(f => ({ ...f, nationalId: e.target.value }))} dir="ltr" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ التعيين</label>
              <input type="date" dir="ltr" value={form.hireDate} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">مدة التجربة (أيام)</label>
              <input type="number" value={form.probationDays} onChange={e => setForm(f => ({ ...f, probationDays: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">نوع التوظيف</label>
            <select value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))} className={inputCls}>
              <option value="full_time">دوام كامل</option>
              <option value="part_time">دوام جزئي</option>
              <option value="contract">عقد مؤقت</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <button onClick={handleSubmit} disabled={create.isPending || !form.name.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2 disabled:opacity-50" style={addBtnStyle}>
            {create.isPending ? "جاري الإضافة..." : "إضافة الموظف"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HREmployees() {
  const { canEdit } = getArchivePermissions();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useEmployees();

  const filtered = (data ?? []).filter(e =>
    !q.trim() || e.name.includes(q) || (e.position ?? "").includes(q) || (e.department ?? "").includes(q));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> الموارد البشرية
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الملفات الرقمية للموظفين</h1>
          <p className="text-sm text-muted-foreground mt-1">بيانات الموظفين ومستنداتهم وإجازاتهم</p>
        </div>
        {canEdit && <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all" style={addBtnStyle}>
          <Plus className="w-4 h-4" /> إضافة موظف
        </button>}
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث عن موظف..."
        className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm" />

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse bg-muted" />)}</div>
      ) : !filtered.length ? (
        <EmptyState icon="🧑‍💼" title="لا يوجد موظفون" description="أضف أول موظف بالضغط على الزر أعلاه" />
      ) : (
        <div className="space-y-3">
          {filtered.map(emp => (
            <Link key={emp.id} to={`/hr/employees/${emp.id}`} className="liquid-glass-card rounded-2xl p-5 flex items-center justify-between gap-4 hover:scale-[1.01] transition-transform">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold truncate">{emp.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                    {emp.position && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{emp.position}</span>}
                    {emp.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3" />{emp.phone}</span>}
                    {emp.email && <span className="flex items-center gap-1" dir="ltr"><Mail className="w-3 h-3" />{emp.email}</span>}
                  </div>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-semibold border shrink-0 ${STATUS_COLOR[emp.status]}`}>
                {STATUS_LABEL[emp.status]}
              </span>
            </Link>
          ))}
        </div>
      )}

      {showAdd && <AddEmployeeModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
