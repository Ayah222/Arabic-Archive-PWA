export type UserType = "manager" | "entry";

export type ProjectStatus = "active" | "completed";

export type DocumentType =
  | "contract"
  | "quotation"
  | "employee_data"
  | "report"
  | "image"
  | "meeting"
  | "letter"
  | "contractor"
  | "drawing";

export type ProjectType =
  | "residential"
  | "commercial"
  | "administrative"
  | "hospitality"
  | "educational"
  | "healthcare"
  | "industrial"
  | "religious"
  | "mixed_use"
  | "infrastructure"
  | "landscape"
  | "urban_planning";

export const PROJECT_TYPES: Record<ProjectType, string> = {
  residential: "سكني",
  commercial: "تجاري",
  administrative: "إداري",
  hospitality: "فندقي",
  educational: "تعليمي",
  healthcare: "صحي",
  industrial: "صناعي",
  religious: "ديني",
  mixed_use: "متعدد الاستخدامات",
  infrastructure: "بنية تحتية",
  landscape: "تنسيق مواقع",
  urban_planning: "تخطيط عمراني",
};

export const CITIES = [
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الرياض",
  "الدمام",
  "الخبر",
  "الطائف",
  "ينبع",
  "تبوك",
  "أبها",
];

// ─── Contract Types ───────────────────────────────────────────────────────────

export type ContractStatus = "active" | "completed" | "terminated" | "draft";

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "نشط",
  completed: "منتهي",
  terminated: "مُفسوخ",
  draft: "مسودة",
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, { bg: string; text: string; darkBg: string; darkText: string }> = {
  active:     { bg: "rgba(16,185,129,0.12)",  text: "#059669", darkBg: "rgba(16,185,129,0.15)",  darkText: "#34d399" },
  completed:  { bg: "rgba(99,102,241,0.12)",  text: "#4338ca", darkBg: "rgba(99,102,241,0.15)",  darkText: "#818cf8" },
  terminated: { bg: "rgba(239,68,68,0.12)",   text: "#dc2626", darkBg: "rgba(239,68,68,0.15)",   darkText: "#f87171" },
  draft:      { bg: "rgba(234,179,8,0.12)",   text: "#b45309", darkBg: "rgba(234,179,8,0.15)",   darkText: "#fbbf24" },
};

export interface Contract {
  id: string;
  number: string;
  projectId: string;
  client: string;
  value: number;
  startDate: string;
  endDate: string;
  durationMonths: number;
  status: ContractStatus;
  classification: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Per-project contractor rating ──────────────────────────────────────────

export interface ProjectContractorRating {
  id: string;
  contractorId: string;
  projectId: string;
  quality: number;
  commitment: number;
  safety: number;
  speed: number;
  notes: string;
}

// ─── Contractor Types ────────────────────────────────────────────────────────

export type ContractorStatus = "active" | "inactive" | "suspended";

export type ContractorSpecialty =
  | "architectural"
  | "structural"
  | "civil"
  | "electrical"
  | "mechanical"
  | "hvac"
  | "infrastructure"
  | "roads"
  | "finishing"
  | "communications";

export const CONTRACTOR_SPECIALTIES: Record<ContractorSpecialty, string> = {
  architectural: "معماري",
  structural: "إنشائي",
  civil: "مدني",
  electrical: "كهربائي",
  mechanical: "ميكانيكي",
  hvac: "تكييف وتهوية",
  infrastructure: "بنية تحتية",
  roads: "طرق",
  finishing: "تشطيبات",
  communications: "اتصالات",
};

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ContractorRatings {
  quality: number;
  commitment: number;
  safety: number;
  speed: number;
}

export interface Project {
  id: string;
  number: string;
  name: string;
  client: string;
  city: string;
  projectType: ProjectType;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  coverImage: string;
  // Extended fields
  contractNumber?: string;
  contractValue?: number;
  awardDate?: string;
  projectDuration?: number;
  endDate?: string;
  projectManager?: string;
  consultant?: string;
  mainContractor?: string;
  completionPercentage?: number;
  mapsLink?: string;
  siteAddress?: string;
}

export interface Document {
  id: string;
  number: string;
  name: string;
  type: DocumentType;
  projectId: string;
  createdAt: string;
  contractorId?: string;
  imageUrl?: string;
  // New fields
  contractId?: string;
  classification?: string;
  status?: string;
  attachments?: string[];
  // Letter / correspondence fields
  letterClassification?: "outgoing" | "incoming" | "meeting_minutes";
  letterNumber?: string;
  letterEntity?: string;
  letterSubject?: string;
  // Meeting fields
  meetingDate?: string;
  meetingLocation?: string;
  attendees?: string[];
  decisions?: string[];
  tasks?: string[];
}

export interface Contractor {
  id: string;
  number: string;
  name: string;
  specialty: ContractorSpecialty;
  commercialRegistration: string;
  commercialRegistrationExpiry?: string;
  phone: string;
  email: string;
  bankAccount: string;
  notes: string;
  status: ContractorStatus;
  projectIds: string[];
  ratings?: ContractorRatings;
  createdAt: string;
  updatedAt: string;
}
