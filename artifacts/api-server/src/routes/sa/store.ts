import { randomUUID } from "crypto";

/* ─────────────── Interfaces ─────────────── */
/* Projects, contracts, contractors, documents, meetings, letters, finance,
 * contacts, categories, attachments, and audit logs are persisted in
 * Supabase — see archiveDb.ts for the CRUD layer. These interfaces remain
 * here as the shared shape used across routes and the archiveDb mappers. */

export interface SAProject {
  id: string;
  name: string;
  description: string;
  client: string;
  status: "active" | "completed" | "on_hold" | "cancelled";
  progress: number;
  startDate: string;
  endDate: string | null;
  budget: number | null;
  location: string | null;
  coverImage: string | null;
  mapsUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SAContract {
  id: string;
  projectId: string;
  title: string;
  party: string;
  value: number;
  startDate: string;
  endDate: string;
  status: "active" | "completed" | "pending" | "cancelled";
  notes: string | null;
  fileUrl: string | null;
  createdAt: string;
}

export interface SAContractorRating {
  workQuality: number;        // جودة العمل (0-100)
  scheduleCompliance: number; // الالتزام بالمواعيد (0-100)
  safetyStandards: number;    // معايير السلامة (0-100)
  executionSpeed: number;     // سرعة التنفيذ (0-100)
  average: number;
  updatedAt: string;
}

export interface SAProjectContractor {
  id: string;
  projectId: string;
  name: string;
  specialty: string;
  phone: string | null;
  email: string | null;
  status: "active" | "inactive";
  notes: string | null;
  rating: SAContractorRating | null;
  createdAt: string;
}

// Prompt 2: Revision history for each document
export interface SADocumentRevision {
  revNumber: number;
  url: string;
  notes: string | null;
  approvalStatus: "under_review" | "approved" | "rejected" | "approved_with_notes";
  uploadedAt: string;
}

export interface SACategory {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
}

export interface SAAttachment {
  id: string;
  projectId: string;
  entityType: "contract" | "meeting" | "letter" | "custom_doc";
  entityId: string;            // contractId / meetingId / letterId / projectId for custom_doc
  dataUrl: string;             // persistent API URL backed by Object Storage
  objectPath: string | null;
  name: string;                // user-defined display name
  customType: string;          // user-defined category/type label
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface SADocument {
  id: string;
  projectId: string;
  name: string;
  docRef: string;
  type: "pdf" | "image" | "word" | "excel" | "powerpoint" | "text" | "other";
  url: string;
  size: number | null;
  notes: string | null;
  // Revision control (Prompt 2)
  revisions: SADocumentRevision[];
  currentRevision: number;
  approvalStatus: "under_review" | "approved" | "rejected" | "approved_with_notes";
  createdAt: string;
}

export interface SAMeeting {
  id: string;
  projectId: string;
  title: string;
  date: string;
  location: string | null;
  attendees: string[];
  agenda: string | null;
  notes: string | null;
  createdAt: string;
}

// Prompt 1: Extended letter with autoRef, recipients, distributionStatus
export interface SALetter {
  id: string;
  projectId: string;
  subject: string;
  direction: "incoming" | "outgoing";
  from: string;
  to: string;
  date: string;
  reference: string | null;
  // Prompt 1 additions
  autoRef: string;
  recipients: Array<"owner" | "consultant" | "contractor" | "technical_office">;
  distributionStatus: "not_sent" | "sent" | "received";
  notes: string | null;
  fileUrl: string | null;
  createdAt: string;
}

export interface SANotification {
  id: string;
  title: string;
  message: string;
  type: "reminder" | "info" | "warning" | "success";
  audience?: "all" | "admin" | "employee";
  scheduledAt: string | null;
  read: boolean;
  projectId: string | null;
  createdAt: string;
}

// Prompt 5: Contacts per project
export interface SAContact {
  id: string;
  projectId: string;
  name: string;
  role: "owner" | "consultant" | "contractor" | "technical_office" | "other";
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
}

// Prompt 7: Audit log
export interface SAAuditLog {
  id: string;
  userId: string;
  userLabel: string;
  action: "create" | "update" | "delete";
  entity: string;
  entityId: string;
  description: string;
  timestamp: string;
}

// Prompt 7: Simple user/role system
export interface SAUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: "admin" | "data_entry" | "viewer";
  createdAt: string;
}

export interface SAFinanceRecord {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  reminderDate: string | null;
  notes: string | null;
  projectId: string | null;
  createdAt: string;
}

/* ─────────────── In-memory data ─────────────── */
/* Only the legacy manager login accounts remain in memory. Archive data,
 * uploaded file metadata, project photos, and notifications are persistent. */

const now = new Date().toISOString();

export const store: {
  users: SAUser[];
} = {
  // Prompt 7: Users
  users: [
    {
      id: "admin",
      username: "admin",
      password: "admin123",
      name: "مدير النظام",
      role: "admin",
      createdAt: now,
    },
    {
      id: "entry1",
      username: "entry",
      password: "entry123",
      name: "موظف إدخال البيانات",
      role: "data_entry",
      createdAt: now,
    },
    {
      id: "viewer1",
      username: "viewer",
      password: "viewer123",
      name: "مستخدم عرض",
      role: "viewer",
      createdAt: now,
    },
  ],
};

export function newId() {
  return randomUUID();
}
