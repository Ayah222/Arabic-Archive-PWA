import { Link } from "react-router-dom";
import { Users, UserSearch, Building2, ChevronLeft } from "lucide-react";
import { useEmployees, useCandidates, useLicenses } from "../../../controllers/useHr";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function HRHome() {
  const { data: employees } = useEmployees();
  const { data: candidates } = useCandidates();
  const { data: licenses } = useLicenses();

  const activeEmployees = employees?.filter(e => e.status === "active").length ?? 0;
  const openCandidates = candidates?.filter(c => c.status !== "rejected" && c.offerStatus !== "accepted").length ?? 0;
  const expiringLicenses = licenses?.filter(l => {
    const d = daysUntil(l.expiryDate);
    return d !== null && d <= 30;
  }).length ?? 0;

  const cards = [
    {
      to: "/hr/employees",
      icon: Users,
      title: "الملفات الرقمية للموظفين",
      desc: "بيانات الموظفين، المستندات، والإجازات مع تنبيهات انتهاء الصلاحية",
      stat: `${activeEmployees} موظف نشط`,
      color: "#00f0ff",
    },
    {
      to: "/hr/candidates",
      icon: UserSearch,
      title: "التوظيف والمرشحون",
      desc: "رفع السير الذاتية واستخراج المهارات ومتابعة حالة العروض",
      stat: `${openCandidates} مرشح قيد المتابعة`,
      color: "#7000ff",
    },
    {
      to: "/hr/corporate",
      icon: Building2,
      title: "الشؤون الإدارية للشركة",
      desc: "السياسات، التراخيص الحكومية، والمراسلات الرسمية",
      stat: expiringLicenses > 0 ? `${expiringLicenses} ترخيص قارب على الانتهاء` : "لا توجد تنبيهات تراخيص",
      color: expiringLicenses > 0 ? "#f59e0b" : "#22c55e",
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الموارد البشرية</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة ملفات الموظفين والتوظيف والشؤون الإدارية للشركة</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {cards.map(({ to, icon: Icon, title, desc, stat, color }) => (
          <Link key={to} to={to} className="liquid-glass-card rounded-2xl p-5 hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </div>
            <h3 className="font-bold mt-4">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
            <p className="text-xs font-semibold mt-3" style={{ color }}>{stat}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
