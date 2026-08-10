// Prompt 11: Onboarding tour for new users
import { useState, useEffect } from "react";

const TOUR_KEY = "sa_onboarding_done";

interface Step {
  icon: string;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  {
    icon: "📁",
    title: "أنشئ مشروعك الأول",
    desc: "انتقل إلى «المشاريع» من القائمة وأضف مشروعك بضغطة واحدة. كل مشروع له لوحة متكاملة تضم عقوده، مستنداته، اجتماعاته وخطاباته.",
  },
  {
    icon: "📄",
    title: "إدارة المخططات مع التحكم بالإصدارات",
    desc: "ارفع المخططات والوثائق الفنية. كل رفع يُسجَّل كإصدار (Rev 0, Rev 1...)، ويمكنك متابعة حالة الاعتماد لكل إصدار بشكل مرئي.",
  },
  {
    icon: "✉️",
    title: "الخطابات والمراسلات منظمة تلقائياً",
    desc: "كل خطاب يحصل على رقم مرجعي تلقائي (LTR-2026-001). تتبع حالة التوزيع وربط الخطاب بالجهة المستلمة.",
  },
  {
    icon: "🔔",
    title: "تنبيهات تلقائية بدون جهد",
    desc: "النظام يراقب تلقائياً المستندات المتأخرة والعقود القاربة على الانتهاء والخطابات غير المؤكدة، ويرسل إشعارات فورية.",
  },
];

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      // Show after short delay
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  const handleClose = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setVisible(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleClose();
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      dir="rtl"
    >
      <div
        className="w-full max-w-sm rounded-3xl p-7 space-y-5 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(15,20,40,0.97) 0%, rgba(20,15,50,0.97) 100%)",
          border: "1px solid rgba(0,240,255,0.18)",
          boxShadow: "0 0 60px rgba(0,240,255,0.12)",
        }}
      >
        {/* Progress */}
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                background: i === step ? "#00f0ff" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-6xl">{current.icon}</div>

        {/* Content */}
        <div>
          <h2 className="text-xl font-black text-foreground mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.desc}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-muted-foreground bg-secondary hover:bg-muted transition-colors"
          >
            تخطي
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors"
            style={{
              background: "linear-gradient(135deg, rgba(0,240,255,0.2) 0%, rgba(112,0,255,0.2) 100%)",
              border: "1px solid rgba(0,240,255,0.3)",
              color: "#00f0ff",
            }}
          >
            {step < STEPS.length - 1 ? "التالي" : "ابدأ الآن"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">{step + 1} / {STEPS.length}</p>
      </div>
    </div>
  );
}
