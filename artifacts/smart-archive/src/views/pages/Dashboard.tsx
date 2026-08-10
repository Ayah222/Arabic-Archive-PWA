import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SA, apiGet } from "../../lib/apiClient";
import ProgressBar from "../components/shared/ProgressBar";
import StatusBadge from "../components/shared/StatusBadge";
import {
  FolderOpen, RefreshCcw, CheckCircle2, PauseCircle,
  FileSignature, FileText, CalendarCheck, Mail,
} from "lucide-react";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  formatCurrency,
  formatRelativeDate,
  type ProjectStatus,
} from "../../models/types";

interface DashboardData {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  totalContracts: number;
  totalDocuments: number;
  totalMeetings: number;
  totalLetters: number;
  unreadNotifications: number;
  recentProjects: {
    id: string; name: string; client: string; status: string;
    progress: number; location: string | null; budget: number | null;
    updatedAt: string;
  }[];
}

interface NeonStatProps {
  value: number;
  label: string;
  Icon: React.ElementType;
  gradient: string;
  glow: string;
  border: string;
  textColor: string;
}

function NeonStat({ value, label, Icon, gradient, glow, border, textColor }: NeonStatProps) {
  return (
    <div className="liquid-glass-card rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 hover:scale-[1.02]">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 relative"
        style={{ background: gradient, border: `1px solid ${border}`, boxShadow: `0 0 22px ${glow}` }}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-black leading-none" style={{ color: textColor }}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["sa-dashboard"],
    queryFn: () => apiGet<DashboardData>(`${SA}/dashboard`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-4 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-20 liquid-glass-card rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center liquid-glass-card rounded-2xl p-10">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-muted-foreground">تعذر تحميل البيانات</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground text-sm mt-1">نظرة عامة على جميع مشاريعك</p>
      </div>

      {/* Primary Stats — Projects */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">المشاريع</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NeonStat value={data.totalProjects}     label="إجمالي المشاريع"   Icon={FolderOpen}   gradient="linear-gradient(135deg,#00f0ff,#7000ff)" glow="rgba(0,240,255,0.35)" border="rgba(0,240,255,0.40)" textColor="#00f0ff" />
          <NeonStat value={data.activeProjects}    label="مشاريع نشطة"       Icon={RefreshCcw}   gradient="linear-gradient(135deg,#00ff88,#00b8ff)" glow="rgba(0,255,136,0.30)" border="rgba(0,255,136,0.35)" textColor="#00ff88" />
          <NeonStat value={data.completedProjects} label="مشاريع مكتملة"     Icon={CheckCircle2} gradient="linear-gradient(135deg,#6366f1,#a855f7)"  glow="rgba(99,102,241,0.35)" border="rgba(99,102,241,0.40)" textColor="#a78bfa" />
          <NeonStat value={data.onHoldProjects}    label="متوقفة"            Icon={PauseCircle}  gradient="linear-gradient(135deg,#f59e0b,#ef4444)"  glow="rgba(245,158,11,0.30)" border="rgba(245,158,11,0.35)" textColor="#fbbf24" />
        </div>
      </div>

      {/* Secondary Stats — Documents */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">الوثائق والسجلات</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NeonStat value={data.totalContracts}  label="العقود"         Icon={FileSignature} gradient="linear-gradient(135deg,#ec4899,#7000ff)"  glow="rgba(236,72,153,0.30)" border="rgba(236,72,153,0.35)" textColor="#f472b6" />
          <NeonStat value={data.totalDocuments}  label="المستندات"      Icon={FileText}      gradient="linear-gradient(135deg,#0ea5e9,#6366f1)"  glow="rgba(14,165,233,0.30)" border="rgba(14,165,233,0.35)" textColor="#38bdf8" />
          <NeonStat value={data.totalMeetings}   label="الاجتماعات"     Icon={CalendarCheck} gradient="linear-gradient(135deg,#00e5ff,#0070ff)"  glow="rgba(0,229,255,0.30)" border="rgba(0,229,255,0.35)" textColor="#00e5ff" />
          <NeonStat value={data.totalLetters}    label="الخطابات"       Icon={Mail}          gradient="linear-gradient(135deg,#ff6b6b,#ff0080)"  glow="rgba(255,0,128,0.30)" border="rgba(255,0,128,0.35)" textColor="#ff80b5" />
        </div>
      </div>

      {/* Recent Projects */}
      {data.recentProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">آخر المشاريع</h2>
            <Link to="/projects" className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color:"#00f0ff" }}>
              عرض الكل
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentProjects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}
                className="block liquid-glass-card rounded-2xl p-5 hover:opacity-90 transition-all duration-200 group">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground truncate group-hover:text-cyan-300 transition-colors">{project.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{project.client}</p>
                  </div>
                  <StatusBadge
                    label={PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
                    colorClass={PROJECT_STATUS_COLORS[project.status as ProjectStatus]}
                  />
                </div>
                <ProgressBar value={project.progress} showLabel size="md" />
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  {project.location && <span>📍 {project.location}</span>}
                  {project.budget && <span>💰 {formatCurrency(project.budget)}</span>}
                  <span className="mr-auto">{formatRelativeDate(project.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
