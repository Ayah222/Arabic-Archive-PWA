import { useEffect, useState, type FormEvent } from "react";
import { Building2, Check, HardDrive, LoaderCircle, Plus } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  role: "admin" | "data_entry" | "viewer";
  active: boolean;
}

interface DriveStatus {
  connected: boolean;
  configured: boolean;
  connectedEmail: string | null;
  sharedAccount: boolean;
  accountVerified: boolean;
}

interface TenantControlsProps {
  isDark: boolean;
  isAdmin: boolean;
  isSystemAdmin: boolean;
  lang: string;
}

async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      body.trimStart().startsWith("<") || response.headers.get("content-type")?.includes("text/html")
        ? "أعاد الخادم صفحة ويب بدلاً من بيانات النظام. أعد تحميل الصفحة وحاول مجدداً."
        : "تعذر قراءة استجابة الخادم.",
    );
  }
}

export default function TenantControls({ isDark, isAdmin, isSystemAdmin, lang }: TenantControlsProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [driveNotice, setDriveNotice] = useState("");

  const surface = isDark ? "rgba(255,255,255,0.035)" : "rgba(99,102,241,0.045)";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.12)";
  const muted = isDark ? "rgba(255,255,255,0.48)" : "#6b7280";
  const text = lang === "en" ? {
    organization: "Organization",
    addOrganization: "Add organization",
    organizationName: "New organization name",
    create: "Create",
    driveTitle: "Private app file storage",
    serviceAccountTitle: "Replit App Storage",
    serviceAccountMissing: "Private app storage is not configured on the server.",
    connectDrive: "Connect office Google Drive",
    driveConnected: "Google Drive connected.",
    driveCancelled: "Google Drive connection was cancelled.",
    driveFailed: "Could not connect Google Drive. Check OAuth settings and try again.",
    connected: "Configured",
    chooseOrganization: "Choose organization",
    loadOrganizations: "Unable to load organizations",
    loadStorage: "Unable to load storage status",
  } : {
    organization: "المؤسسة",
    addOrganization: "إضافة مؤسسة",
    organizationName: "اسم المؤسسة الجديدة",
    create: "إنشاء",
    driveTitle: "تخزين ملفات التطبيق الخاص",
    serviceAccountTitle: "تخزين Replit الخاص",
    serviceAccountMissing: "لم يتم إعداد تخزين الملفات الخاص على الخادم.",
    connectDrive: "ربط Google Drive الخاص بالمكتب",
    driveConnected: "تم ربط Google Drive بنجاح.",
    driveCancelled: "تم إلغاء ربط Google Drive.",
    driveFailed: "تعذر ربط Google Drive. تحقق من إعدادات OAuth وحاول مجدداً.",
    connected: "مُعدّ",
    chooseOrganization: "اختيار المؤسسة",
    loadOrganizations: "تعذر تحميل المؤسسات",
    loadStorage: "تعذر تحميل حالة التخزين",
  };

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      fetch("/api/sa/tenants", { credentials: "include" }),
      isAdmin ? fetch("/api/sa/tenants/storage", { credentials: "include" }) : Promise.resolve(null),
    ]).then(async ([tenantResponse, driveResponse]) => {
      if (!tenantResponse.ok) throw new Error(text.loadOrganizations);
      const nextTenants = await readApiJson<Tenant[]>(tenantResponse);
      let nextDrive: DriveStatus | null = null;
      if (driveResponse) {
        if (!driveResponse.ok) throw new Error(text.loadStorage);
        nextDrive = await readApiJson<DriveStatus>(driveResponse);
      }
      if (mounted) {
        setTenants(nextTenants);
        setDrive(nextDrive);
        setError("");
      }
    }).catch((loadError: unknown) => {
      if (mounted) setError(loadError instanceof Error ? loadError.message : text.loadOrganizations);
    });
    return () => { mounted = false; };
  }, [isAdmin, text.loadOrganizations, text.loadStorage]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("driveOAuth");
    if (!result) return;
    if (result === "connected") setDriveNotice(text.driveConnected);
    else if (result === "cancelled") setDriveNotice(text.driveCancelled);
    else setDriveNotice(text.driveFailed);
    const url = new URL(window.location.href);
    url.searchParams.delete("driveOAuth");
    window.history.replaceState({}, "", url);
  }, [text.driveConnected, text.driveCancelled, text.driveFailed]);

  async function switchTenant(tenantId: string) {
    if (!tenantId || tenants.find((tenant) => tenant.id === tenantId)?.active) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/sa/tenants/active", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const result = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "تعذر تبديل المؤسسة");
      window.location.reload();
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "تعذر تبديل المؤسسة");
      setBusy(false);
    }
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/sa/tenants", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "تعذر إنشاء المؤسسة");
      window.location.reload();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "تعذر إنشاء المؤسسة");
      setBusy(false);
    }
  }

  return (
    <section className="mx-3 mt-3 mb-2 rounded-xl p-3 space-y-2.5" style={{ background: surface, border: `1px solid ${border}` }} dir={lang === "en" ? "ltr" : "rtl"}>
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 shrink-0" style={{ color: isDark ? "#4dd6e4" : "#6366f1" }} />
        <span className="text-xs font-bold flex-1" style={{ color: isDark ? "#fff" : "#25224d" }}>{text.organization}</span>
        {busy && <LoaderCircle className="w-3.5 h-3.5 animate-spin" style={{ color: muted }} />}
      </div>

      {isSystemAdmin ? (
        <select
          aria-label={text.chooseOrganization}
          value={tenants.find((tenant) => tenant.active)?.id ?? ""}
          disabled={busy || tenants.length === 0}
          onChange={(event) => void switchTenant(event.target.value)}
          className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
          style={{ color: isDark ? "#f3f4f6" : "#25224d", background: isDark ? "rgba(0,0,0,0.24)" : "rgba(255,255,255,0.76)", border: `1px solid ${border}` }}
        >
          {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
        </select>
      ) : (
        <div
          role="status"
          aria-label={text.organization}
          className="w-full rounded-lg px-2.5 py-2 text-xs"
          style={{ color: isDark ? "#f3f4f6" : "#25224d", background: isDark ? "rgba(0,0,0,0.24)" : "rgba(255,255,255,0.76)", border: `1px solid ${border}` }}
        >
          {tenants.find((tenant) => tenant.active)?.name ?? "—"}
        </div>
      )}

      {isAdmin && (
        <>
          {isSystemAdmin && (showCreate ? (
              <form onSubmit={(event) => void createTenant(event)} className="flex gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  maxLength={120}
                  placeholder={text.organizationName}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ color: isDark ? "#f3f4f6" : "#25224d", background: isDark ? "rgba(0,0,0,0.24)" : "#fff", border: `1px solid ${border}` }}
                />
                <button type="submit" disabled={!newName.trim() || busy} className="rounded-lg px-2 text-xs font-bold disabled:opacity-50" style={{ background: isDark ? "rgba(0,210,230,0.15)" : "rgba(99,102,241,0.12)", color: isDark ? "#6de4ed" : "#5557bb" }}>
                  {text.create}
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setShowCreate(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold" style={{ color: muted }}>
                <Plus className="w-3.5 h-3.5" />
                {text.addOrganization}
              </button>
            ))}

          <div className="pt-2" style={{ borderTop: `1px solid ${border}` }}>
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold" style={{ color: muted }}>
              <HardDrive className="w-3.5 h-3.5" />
              {text.driveTitle}
            </div>
            {drive?.configured ? (
              <div className="flex items-center gap-1.5 text-[10px]" style={{ color: isDark ? "#86efac" : "#15803d" }}>
                <Check className="w-3.5 h-3.5" />
                <span className="truncate">{drive.connectedEmail || text.serviceAccountTitle}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { window.location.href = "/api/sa/tenants/storage/oauth/start"; }}
                className="w-full rounded-lg px-2 py-1.5 text-start text-[10px] font-semibold"
                style={{ background: isDark ? "rgba(0,210,230,0.12)" : "rgba(99,102,241,0.1)", color: isDark ? "#6de4ed" : "#4f46b5" }}
              >
                {text.connectDrive}
              </button>
            )}
            {driveNotice && <p role="status" className="mt-1 text-[10px] leading-relaxed" style={{ color: isDark ? "#86efac" : "#15803d" }}>{driveNotice}</p>}
          </div>
        </>
      )}

      {error && <p role="alert" className="text-[10px] leading-relaxed" style={{ color: isDark ? "#fca5a5" : "#b91c1c" }}>{error}</p>}
    </section>
  );
}