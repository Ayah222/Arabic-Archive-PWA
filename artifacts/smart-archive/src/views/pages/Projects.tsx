import { useState } from "react";
import { Link } from "react-router-dom";
import { useProjects, useProjectActions } from "../../controllers/useProjects";
import ProgressBar from "../components/shared/ProgressBar";
import StatusBadge from "../components/shared/StatusBadge";
import Modal from "../components/shared/Modal";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import EmptyState from "../components/shared/EmptyState";
import Toast from "../components/shared/Toast";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  getProjectStatusLabel,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  formatCurrency,
  formatDate,
  type ProjectStatus,
} from "../../models/types";
import type { ProjectInput, ProjectUpdate } from "../../controllers/useProjects";
import { getArchivePermissions } from "../../controllers/permissions";

const STATUS_OPTIONS: ProjectStatus[] = ["active", "completed", "on_hold", "cancelled"];

interface ProjectFormData {
  name: string;
  description: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  startDate: string;
  endDate: string;
  budget: string;
  location: string;
}

const defaultForm: ProjectFormData = {
  name: "",
  description: "",
  client: "",
  status: "active",
  progress: 0,
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  budget: "",
  location: "",
};

export default function Projects() {
  const { t, lang } = useLanguage();
  const { canEdit, canDelete } = getArchivePermissions();
  const statusLabel = (s: ProjectStatus) => getProjectStatusLabel(s, lang);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<{ id: string; data: ProjectFormData } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormData>(defaultForm);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { data: projects, isLoading } = useProjects(
    search || statusFilter
      ? { q: search || undefined, status: statusFilter || undefined }
      : undefined
  );

  const { createProject, updateProject, deleteProject } = useProjectActions();

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    const input: ProjectInput = {
      name: form.name, description: form.description, client: form.client.trim() || undefined,
      status: form.status, progress: form.progress, startDate: form.startDate,
      endDate: form.endDate || null, budget: form.budget ? Number(form.budget) : null,
      location: form.location || null,
    };
    try {
      await createProject.mutateAsync({ data: input });
      setShowCreate(false); setForm(defaultForm);
      setToast({ message: t("projectCreated"), type: "success" });
    } catch {
      setToast({ message: t("projectCreateFail"), type: "error" });
    }
  };

  const handleUpdate = async () => {
    if (!editProject) return;
    const update: ProjectUpdate = {
      name: editProject.data.name, description: editProject.data.description,
      client: editProject.data.client, status: editProject.data.status,
      progress: editProject.data.progress, startDate: editProject.data.startDate,
      endDate: editProject.data.endDate || null,
      budget: editProject.data.budget ? Number(editProject.data.budget) : null,
      location: editProject.data.location || null,
    };
    try {
      await updateProject.mutateAsync({ id: editProject.id, data: update });
      setEditProject(null);
      setToast({ message: t("projectUpdated"), type: "success" });
    } catch {
      setToast({ message: t("projectUpdateFail"), type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProject.mutateAsync({ id: deleteId });
      setDeleteId(null);
      setToast({ message: t("projectDeleted"), type: "success" });
    } catch {
      setToast({ message: t("projectDeleteFail"), type: "error" });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("projects")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects?.length ?? 0} {lang === "ar" ? "مشروع" : "project(s)"}
          </p>
        </div>
        {canEdit && <button
          onClick={() => { setForm(defaultForm); setShowCreate(true); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span>+</span> {t("newProject")}
        </button>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchProject")}
          className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        >
          <option value="">{t("allStatuses")}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon="📁"
          title={t("noProjects")}
          description={t("noProjectsSub")}
          action={canEdit ? (
            <button
              onClick={() => { setForm(defaultForm); setShowCreate(true); }}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              {t("addProject")}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-card rounded-2xl border border-border shadow-sm hover:border-primary hover:shadow-md transition-all duration-200"
            >
              <Link to={`/projects/${project.id}`} className="block p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground truncate">{project.name}</h3>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{project.client}</p>
                  </div>
                  <StatusBadge
                    label={statusLabel(project.status as ProjectStatus)}
                    colorClass={PROJECT_STATUS_COLORS[project.status as ProjectStatus]}
                  />
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                <ProgressBar value={project.progress} showLabel size="md" />
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  {project.location && <span>📍 {project.location}</span>}
                  <span>📅 {formatDate(project.startDate)}</span>
                  {project.budget && <span>💰 {formatCurrency(project.budget)}</span>}
                </div>
              </Link>
              {(canEdit || canDelete) && <div className="flex border-t border-border">
                {canEdit && <>
                <button
                  onClick={() => setEditProject({
                    id: project.id,
                    data: {
                      name: project.name, description: project.description,
                      client: project.client, status: project.status as ProjectStatus,
                      progress: project.progress, startDate: project.startDate,
                      endDate: project.endDate ?? "", budget: project.budget?.toString() ?? "",
                      location: project.location ?? "",
                    },
                  })}
                  className="flex-1 py-3 text-sm text-primary hover:bg-primary/10 transition-colors rounded-bl-2xl font-medium"
                >
                  {t("edit")}
                </button>
                {canDelete && <div className="w-px bg-border" />}
                </>}
                {canDelete &&
                <button
                  onClick={() => setDeleteId(project.id)}
                  className="flex-1 py-3 text-sm text-destructive hover:bg-red-50 transition-colors rounded-br-2xl font-medium"
                >
                  {t("delete")}
                </button>
                }
              </div>
              }
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={t("newProject")} size="lg">
        <ProjectForm
          data={form}
          onChange={setForm}
          onSubmit={handleCreate}
          loading={createProject.isPending}
          submitLabel={t("createProjectBtn")}
        />
      </Modal>

      {editProject && (
        <Modal isOpen onClose={() => setEditProject(null)} title={t("edit")} size="lg">
          <ProjectForm
            data={editProject.data}
            onChange={(d) => setEditProject({ ...editProject, data: d })}
            onSubmit={handleUpdate}
            loading={updateProject.isPending}
            submitLabel={t("saveEdits")}
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t("deleteProject")}
        message={t("deleteProjectMsg")}
        confirmLabel={t("delete")}
        danger
        loading={deleteProject.isPending}
      />
    </div>
  );
}

function ProjectForm({
  data, onChange, onSubmit, loading, submitLabel,
}: {
  data: ProjectFormData;
  onChange: (d: ProjectFormData) => void;
  onSubmit: () => void;
  loading: boolean;
  submitLabel: string;
}) {
  const { t } = useLanguage();
  const set = (k: keyof ProjectFormData, v: string | number) =>
    onChange({ ...data, [k]: v });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">{t("projectNameLabel")}</label>
        <input value={data.name} onChange={(e) => set("name", e.target.value)}
          placeholder={t("projectNamePlaceholder")}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">{t("descLabel")}</label>
        <textarea value={data.description} onChange={(e) => set("description", e.target.value)}
          placeholder={t("descPlaceholder")} rows={3}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">{t("clientLabel")}</label>
        <input value={data.client} onChange={(e) => set("client", e.target.value)}
          placeholder={t("clientPlaceholder")}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">{t("statusLabel")}</label>
          <select value={data.status} onChange={(e) => set("status", e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm">
            {(["active", "completed", "on_hold", "cancelled"] as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">{t("progressLabel")} ({data.progress}%)</label>
          <input type="range" min={0} max={100} value={data.progress}
            onChange={(e) => set("progress", parseInt(e.target.value))}
            className="w-full mt-2 accent-primary" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">{t("startDateLabel")}</label>
          <input type="date" lang="en-GB" dir="rtl" value={data.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm archive-date-input" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">{t("endDateLabel")}</label>
          <input type="date" lang="en-GB" dir="rtl" value={data.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm archive-date-input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">{t("budgetLabel")}</label>
          <input type="number" value={data.budget} onChange={(e) => set("budget", e.target.value)}
            placeholder="0"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">{t("locationLabel")}</label>
          <input value={data.location} onChange={(e) => set("location", e.target.value)}
            placeholder={t("locationPlaceholder")}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">{t("mapsLabel")}</label>
        <input
          value={(data as { mapsUrl?: string }).mapsUrl ?? ""}
          onChange={(e) => onChange({ ...data, mapsUrl: e.target.value } as typeof data & { mapsUrl: string })}
          placeholder="https://maps.google.com/..."
          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          dir="ltr" type="url" />
      </div>
      <button onClick={onSubmit} disabled={loading || !data.name.trim()}
        className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 mt-2">
        {loading ? t("saving") : submitLabel}
      </button>
    </div>
  );
}
