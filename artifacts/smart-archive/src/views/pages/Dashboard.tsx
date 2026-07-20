import { Link } from "react-router-dom";
import { useGetDashboard } from "@workspace/api-client-react";
import ProgressBar from "../components/shared/ProgressBar";
import StatusBadge from "../components/shared/StatusBadge";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  formatCurrency,
  formatRelativeDate,
  type ProjectStatus,
} from "../../models/types";

function StatCard({ value, label, icon, color }: { value: number; label: string; icon: string; color: string }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-muted-foreground">تعذر تحميل البيانات</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground text-sm mt-1">نظرة عامة على جميع مشاريعك</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          value={data.totalProjects}
          label="إجمالي المشاريع"
          icon="📁"
          color="bg-blue-100"
        />
        <StatCard
          value={data.activeProjects}
          label="مشاريع نشطة"
          icon="🔄"
          color="bg-green-100"
        />
        <StatCard
          value={data.completedProjects}
          label="مشاريع مكتملة"
          icon="✅"
          color="bg-emerald-100"
        />
        <StatCard
          value={data.onHoldProjects}
          label="متوقفة"
          icon="⏸️"
          color="bg-yellow-100"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard value={data.totalContracts} label="العقود" icon="📋" color="bg-purple-100" />
        <StatCard value={data.totalDocuments} label="المستندات" icon="📄" color="bg-indigo-100" />
        <StatCard value={data.totalMeetings} label="الاجتماعات" icon="🤝" color="bg-cyan-100" />
        <StatCard value={data.totalLetters} label="الخطابات" icon="✉️" color="bg-pink-100" />
      </div>

      {/* Recent Projects */}
      {data.recentProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">آخر المشاريع</h2>
            <Link
              to="/projects"
              className="text-sm text-primary hover:underline font-medium"
            >
              عرض الكل
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="block bg-card rounded-2xl p-5 shadow-sm border border-border hover:border-primary hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{project.client}</p>
                  </div>
                  <StatusBadge
                    label={PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
                    colorClass={PROJECT_STATUS_COLORS[project.status as ProjectStatus]}
                  />
                </div>
                <div className="space-y-1">
                  <ProgressBar value={project.progress} size="md" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{project.location ?? "—"}</span>
                    <span>{project.progress}%</span>
                  </div>
                </div>
                {project.budget && (
                  <p className="text-xs text-muted-foreground mt-2">
                    الميزانية: <span className="font-medium text-foreground">{formatCurrency(project.budget)}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  آخر تحديث: {formatRelativeDate(project.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.recentProjects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-5xl mb-4">📂</p>
          <h3 className="text-lg font-semibold mb-2">لا توجد مشاريع بعد</h3>
          <p className="text-muted-foreground text-sm mb-4">ابدأ بإضافة أول مشروع لك</p>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            إضافة مشروع
          </Link>
        </div>
      )}
    </div>
  );
}
