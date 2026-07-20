export type ProjectStatus = "active" | "completed" | "on_hold" | "cancelled";
export type ContractStatus = "active" | "completed" | "pending" | "cancelled";
export type ContractorStatus = "active" | "inactive";
export type DocumentType = "pdf" | "image" | "word" | "excel" | "other";
export type LetterDirection = "incoming" | "outgoing";
export type NotificationType = "reminder" | "info" | "warning" | "success";
export type VoiceAction = "reminder" | "search" | "add" | "unknown";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "نشط",
  completed: "مكتمل",
  on_hold: "متوقف",
  cancelled: "ملغي",
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "نشط",
  completed: "مكتمل",
  pending: "معلق",
  cancelled: "ملغي",
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  pdf: "PDF",
  image: "صورة",
  word: "Word",
  excel: "Excel",
  other: "أخرى",
};

export const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  pdf: "📄",
  image: "🖼️",
  word: "📝",
  excel: "📊",
  other: "📁",
};

export const NOTIFICATION_TYPE_COLORS: Record<NotificationType, string> = {
  reminder: "bg-purple-100 text-purple-800",
  info: "bg-blue-100 text-blue-800",
  warning: "bg-yellow-100 text-yellow-800",
  success: "bg-green-100 text-green-800",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  reminder: "تذكير",
  info: "معلومة",
  warning: "تنبيه",
  success: "نجاح",
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr));
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
  if (diffDays < 365) return `منذ ${Math.floor(diffDays / 30)} أشهر`;
  return `منذ ${Math.floor(diffDays / 365)} سنوات`;
}
