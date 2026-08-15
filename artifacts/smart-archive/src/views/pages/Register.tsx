import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FolderOpen, CheckCircle2, Loader2 } from "lucide-react";
import { validateInviteToken, registerEmployee } from "../../controllers/useSupabaseUsers";

const Aurora = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    <div style={{ position:"absolute", width:900, height:750, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(0,240,255,0.18) 0%, rgba(0,240,255,0.06) 40%, transparent 70%)", filter:"blur(90px)", top:-320, right:-120 }} />
    <div style={{ position:"absolute", width:750, height:600, background:"radial-gradient(ellipse, rgba(112,0,255,0.22) 0%, rgba(112,0,255,0.06) 45%, transparent 72%)", filter:"blur(110px)", top:-80, left:"12%" }} />
  </div>
);

type Step = "validating" | "invalid" | "form" | "done";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [step, setStep] = useState<Step>("validating");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ name: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setStep("invalid"); return; }
    validateInviteToken(token).then((e) => {
      if (e) { setEmail(e); setStep("form"); }
      else setStep("invalid");
    });
  }, [token]);

  const handleSubmit = async () => {
    setError(null);
    if (!form.name.trim()) { setError("يرجى إدخال اسمك الكامل"); return; }
    if (form.password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    if (form.password !== form.confirm) { setError("كلمتا المرور غير متطابقتين"); return; }

    setLoading(true);
    try {
      await registerEmployee(token, form.name.trim(), form.password);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" dir="rtl"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(18,10,40,1) 0%, rgba(5,4,18,1) 60%)" }}>
      <Aurora />
      <div className="w-full max-w-sm relative z-10 space-y-5">

        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
            style={{ background:"linear-gradient(135deg,#00f0ff 0%,#7000ff 100%)", boxShadow:"0 0 40px rgba(0,240,255,0.45)", border:"1px solid rgba(0,240,255,0.35)" }}>
            <FolderOpen className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">إنشاء حسابك</h1>
            <p className="text-sm mt-0.5" style={{ color:"rgba(0,240,255,0.65)" }}>نظام الأرشيف الذكي</p>
          </div>
        </div>

        {/* Validating */}
        {step === "validating" && (
          <div className="rounded-2xl p-8 text-center"
            style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.10)" }}>
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color:"#00f0ff" }} />
            <p className="text-white/70 text-sm">جاري التحقق من رابط الدعوة...</p>
          </div>
        )}

        {/* Invalid token */}
        {step === "invalid" && (
          <div className="rounded-2xl p-8 text-center"
            style={{ background:"rgba(255,60,60,0.06)", border:"1px solid rgba(255,60,60,0.25)" }}>
            <p className="text-4xl mb-3">⛔</p>
            <p className="text-white font-bold mb-1">رابط الدعوة غير صالح</p>
            <p className="text-white/50 text-sm">قد يكون الرابط منتهياً أو مستخدماً مسبقاً</p>
            <button onClick={() => navigate("/login")}
              className="mt-4 text-sm font-semibold" style={{ color:"#00f0ff" }}>
              العودة للدخول
            </button>
          </div>
        )}

        {/* Registration form */}
        {step === "form" && (
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.10)", backdropFilter:"blur(24px)" }}>

            {/* Email badge */}
            <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
              style={{ background:"rgba(0,240,255,0.06)", border:"1px solid rgba(0,240,255,0.18)" }}>
              <span className="text-xs" style={{ color:"rgba(255,255,255,0.50)" }}>البريد الإلكتروني:</span>
              <span className="text-sm font-mono font-bold" style={{ color:"#00f0ff" }}>{email}</span>
            </div>

            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="الاسم الكامل"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(0,240,255,0.25)" }}
                dir="rtl"
              />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="كلمة المرور (6 أحرف على الأقل)"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)" }}
                dir="ltr"
              />
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="تأكيد كلمة المرور"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)" }}
                dir="ltr"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {error && (
              <div className="rounded-xl p-3 text-sm" style={{ background:"rgba(255,60,60,0.10)", border:"1px solid rgba(255,60,60,0.25)", color:"#ff8080" }}>
                {error}
              </div>
            )}

            <div className="rounded-xl p-3 text-xs" style={{ background:"rgba(255,200,0,0.07)", border:"1px solid rgba(255,200,0,0.18)", color:"rgba(255,200,100,0.80)" }}>
              ⏳ بعد التسجيل، سيكون حسابك بانتظار التفعيل من المدير قبل أن تتمكن من الدخول.
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-black text-base transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background:"linear-gradient(135deg,#00f0ff 0%,#7000ff 100%)", color:"#fff", boxShadow:"0 0 30px rgba(0,240,255,0.35)" }}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "إنشاء الحساب"}
            </button>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="rounded-2xl p-8 text-center space-y-3"
            style={{ background:"rgba(0,255,136,0.05)", border:"1px solid rgba(0,255,136,0.20)" }}>
            <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color:"#00ff88" }} />
            <p className="text-white font-black text-lg">تم التسجيل بنجاح!</p>
            <p className="text-white/60 text-sm">حسابك قيد المراجعة. سيتم إشعارك عند تفعيله من قبل المدير.</p>
            <button onClick={() => navigate("/login")}
              className="mt-2 w-full py-3 rounded-xl font-bold text-sm"
              style={{ background:"rgba(0,255,136,0.12)", color:"#00ff88", border:"1px solid rgba(0,255,136,0.25)" }}>
              العودة لتسجيل الدخول
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
