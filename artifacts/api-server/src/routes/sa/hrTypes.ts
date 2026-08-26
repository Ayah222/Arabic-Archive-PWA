// Shared interfaces for the HR module (وحدة الموارد البشرية). Persisted in
// Supabase — see hrDb.ts for the CRUD layer. Mirrors the SA* type + archiveDb
// pattern used by the rest of the archive domain.

export interface HREmployee {
  id: string;
  name: string;
  nationalId: string | null;
  position: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  hireDate: string | null;
  employmentType: "full_time" | "part_time" | "contract";
  status: "active" | "on_leave" | "terminated";
  probationDays: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// The four fixed document categories for the employee digital file.
export type HRDocumentCategory = "personal" | "contract" | "qualifications" | "performance";

export interface HREmployeeDocument {
  id: string;
  employeeId: string;
  category: HRDocumentCategory;
  name: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  description: string | null;
  expiryDate: string | null;
  uploadedAt: string;
}

export interface HREmployeeLeave {
  id: string;
  employeeId: string;
  leaveType: "annual" | "sick" | "unpaid" | "other";
  startDate: string;
  endDate: string;
  notes: string | null;
  createdAt: string;
}

export interface HRCandidate {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  positionApplied: string | null;
  cvUrl: string | null;
  skills: string[];
  status: "new" | "screening" | "interview" | "offered" | "hired" | "rejected";
  offerStatus: "none" | "pending" | "accepted" | "declined";
  offerSalary: number | null;
  offerStartDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface HRPolicy {
  id: string;
  title: string;
  category: string | null;
  fileUrl: string | null;
  description: string | null;
  effectiveDate: string | null;
  createdAt: string;
}

export interface HRLicense {
  id: string;
  name: string;
  licenseNumber: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export interface HRCorrespondence {
  id: string;
  subject: string;
  direction: "incoming" | "outgoing";
  authority: string | null;
  date: string | null;
  reference: string | null;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
}
