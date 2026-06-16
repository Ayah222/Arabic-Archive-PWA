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
}

export interface Contractor {
  id: string;
  number: string;
  name: string;
  specialty: ContractorSpecialty;
  commercialRegistration: string;
  phone: string;
  email: string;
  bankAccount: string;
  notes: string;
  status: ContractorStatus;
  projectIds: string[];
  createdAt: string;
  updatedAt: string;
}
