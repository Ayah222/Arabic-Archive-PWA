// Prompt 11: Onboarding tour for new users
import { useState, useEffect } from "react";
import { getCurrentUser } from "../../../controllers/useGlobal";
import { getArchivePermissions } from "../../../controllers/permissions";

const TOUR_KEY = "sa_onboarding_done";

interface Step {
  icon: string;
  title: string;
  desc: string;
}

const getSteps = (canEdit: boolean, canDelete: boolean, canManageUsers: boolean): Step[] => [
  {
    icon: "🧭",
    title: "ابدأ من القائمة الجانبية",
    desc: "ستجد هنا «لوحة التحكم»، «المشاريع»، «العقود»، «المقاولون»، «الاجتماعات»، «الخطابات والمراسلات»، «الأرشيف المالي»، «البحث الموحد»، «التقارير»، و«الأسئلة الشائعة».",
  },
  {
    icon: "📁",
    title: canEdit ? "أنشئ أو افتح مشروعاً" : "افتح المشروع المطلوب",
    desc: canEdit
      ? "من «المشاريع» اضغط «+ مشروع جديد» في أعلى الصفحة للبدء، أو استخدم «تعديل» داخل بطاقة أي مشروع. اضغط على اسم المشروع لفتح تفاصيله."
      : "من «المشاريع» اضغط على اسم المشروع لفتح تفاصيله. ستتمكن من مراجعة البيانات دون ظهور أزرار التعديل أو الإضافة.",
  },
  {
    icon: "🗂️",
    title: "تعرّف على تبويبات المشروع",
    desc: "داخل المشروع ستجد تبويبات «العقود»، «المقاولون»، «المخططات»، «الاجتماعات»، «الخطابات»، «جهات الاتصال»، و«الصور». استخدم التبويب المناسب للوصول إلى المعلومة بسرعة.",
  },
  {
    icon: canEdit ? "➕" : "👁️",
    title: canEdit ? "مكان أزرار الإضافة والرفع" : "المشاهدة والطباعة متاحتان لك",
    desc: canEdit
      ? "أزرار الإضافة موجودة أعلى كل تبويب: «+ إضافة عقد»، «+ إضافة مقاول»، «+ إضافة اجتماع»، «+ إضافة خطاب»، و«+ رفع مستند». ويمكنك استخدام «➕ فئة جديدة» و«+ إرفاق ملف» لتنظيم الملفات."
      : "يمكنك فتح كل التبويبات وقراءة البيانات، ثم الضغط على «تقرير PDF / طباعة» بجانب اسم المشروع لطباعة التقرير أو حفظه كملف PDF. لن تظهر لك أزرار الإضافة أو الرفع أو التعديل أو الحذف.",
  },
  {
    icon: "🖨️",
    title: "التقارير والبحث في مكانهما",
    desc: "استخدم «البحث الموحد» للوصول إلى مشروع أو عقد أو خطاب بسرعة. ومن «التقارير» اختر التقرير الأسبوعي أو الشهري واضغط «تصدير PDF» للطباعة أو الحفظ.",
  },
  canManageUsers
    ? {
        icon: "🛡️",
        title: "إدارة المستخدمين وسجل النشاط",
        desc: "ستجد «المستخدمون» في القائمة الجانبية. من هناك فعّل الحسابات وحدد دور كل مستخدم، ثم افتح تبويب «سجل النشاط» لمراجعة اسم المنفذ والتاريخ ووصف الإجراءات.",
      }
    : {
        icon: "🔐",
        title: canDelete ? "صلاحياتك في النظام" : "صلاحياتك في النظام",
        desc: canDelete
          ? "لديك صلاحية المدير الكاملة، بما فيها إدارة المستخدمين والحذف النهائي. استخدم الحذف بحذر، وتابع الإجراءات من سجل النشاط."
          : "صلاحيتك تسمح بالمشاهدة والطباعة، أو بالإضافة والرفع والتعديل حسب دورك. الحذف النهائي وإدارة المستخدمين متاحان للمدير فقط.",
      },
];

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const currentUser = getCurrentUser();
  const { canEdit, canDelete, canManageUsers } = getArchivePermissions();
  const steps = getSteps(canEdit, canDelete, canManageUsers);
  const tourKey = `${TOUR_KEY}:${currentUser?.id ?? currentUser?.username ?? "guest"}`;

  useEffect(() => {
    if (localStorage.getItem(tourKey)) return;
    // Show after short delay
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [tourKey]);

  const handleClose = () => {
    localStorage.setItem(tourKey, "1");
    setVisible(false);
  };

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else handleClose();
  };

  if (!visible) return null;

  const current = steps[step];

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
          {steps.map((_, i) => (
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
            {step < steps.length - 1 ? "التالي" : "ابدأ الآن"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">{step + 1} / {steps.length}</p>
      </div>
    </div>
  );
}
