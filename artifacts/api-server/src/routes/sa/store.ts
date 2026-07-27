import { randomUUID } from "crypto";

/* ─────────────── Interfaces ─────────────── */

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

export interface SADocument {
  id: string;
  projectId: string;
  name: string;
  type: "pdf" | "image" | "word" | "excel" | "other";
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

/* ─────────────── Auto-reference counter ─────────────── */

export const counters = {
  letterRef: 0,
};

export function nextLetterRef(): string {
  counters.letterRef += 1;
  return `LTR-${new Date().getFullYear()}-${String(counters.letterRef).padStart(3, "0")}`;
}

/* ─────────────── Seed data ─────────────── */

const now = new Date().toISOString();
const p1 = "proj-001";
const p2 = "proj-002";
const p3 = "proj-003";

export const store: {
  projects: SAProject[];
  contracts: SAContract[];
  contractors: SAProjectContractor[];
  documents: SADocument[];
  meetings: SAMeeting[];
  letters: SALetter[];
  notifications: SANotification[];
  finance: SAFinanceRecord[];
  contacts: SAContact[];
  auditLogs: SAAuditLog[];
  users: SAUser[];
} = {
  projects: [
    {
      id: p1,
      name: "برج الأعمال المركزي",
      description: "بناء برج تجاري من 25 طابق في وسط المدينة، يشمل مكاتب ومراكز تجارية ومواقف سيارات متعددة الطوابق.",
      client: "مجموعة الخليج العقارية",
      status: "active",
      progress: 65,
      startDate: "2024-01-15",
      endDate: "2025-12-31",
      budget: 15000000,
      location: "الرياض، حي العليا",
      coverImage: null,
      createdAt: "2024-01-10T08:00:00Z",
      updatedAt: "2025-01-15T10:00:00Z",
    },
    {
      id: p2,
      name: "مجمع الواحة السكني",
      description: "مشروع سكني متكامل يضم 120 وحدة سكنية بين شقق وفيلات، مع مرافق ترفيهية وتجارية متكاملة.",
      client: "شركة الإنشاءات الحديثة",
      status: "active",
      progress: 42,
      startDate: "2024-06-01",
      endDate: "2026-06-30",
      budget: 28000000,
      location: "جدة، حي النسيم",
      coverImage: null,
      createdAt: "2024-05-20T09:00:00Z",
      updatedAt: "2025-02-01T11:00:00Z",
    },
    {
      id: p3,
      name: "مركز الطبي المتخصص",
      description: "إنشاء مركز طبي متخصص من 8 طوابق يحتوي على عيادات ومختبرات ووحدات إقامة للمرضى.",
      client: "مؤسسة الصحة والرعاية",
      status: "completed",
      progress: 100,
      startDate: "2023-03-01",
      endDate: "2024-11-30",
      budget: 22000000,
      location: "الدمام، حي النور",
      coverImage: null,
      createdAt: "2023-02-20T07:00:00Z",
      updatedAt: "2024-12-01T09:00:00Z",
    },
  ],
  contracts: [
    {
      id: randomUUID(),
      projectId: p1,
      title: "عقد التشييد الرئيسي",
      party: "شركة البناء المتحدة",
      value: 8500000,
      startDate: "2024-02-01",
      endDate: "2025-11-30",
      status: "active",
      notes: "شامل كافة أعمال الهيكل الإنشائي",
      fileUrl: null,
      createdAt: "2024-01-25T10:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p1,
      title: "عقد الأنظمة الكهربائية",
      party: "مؤسسة الطاقة الذكية",
      value: 1200000,
      startDate: "2024-05-01",
      endDate: "2025-10-31",
      status: "active",
      notes: null,
      fileUrl: null,
      createdAt: "2024-04-15T09:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p2,
      title: "عقد أعمال المدنية",
      party: "شركة المباني الحديثة",
      value: 12000000,
      startDate: "2024-07-01",
      endDate: "2026-05-31",
      status: "active",
      notes: null,
      fileUrl: null,
      createdAt: "2024-06-20T08:00:00Z",
    },
  ],
  contractors: [
    {
      id: randomUUID(),
      projectId: p1,
      name: "أحمد محمد الزهراني",
      specialty: "هندسة إنشائية",
      phone: "0501234567",
      email: "ahmed@example.com",
      status: "active",
      notes: "مشرف موقع رئيسي",
      rating: { workQuality: 90, scheduleCompliance: 85, safetyStandards: 95, executionSpeed: 80, average: 88, updatedAt: now },
      createdAt: now,
    },
    {
      id: randomUUID(),
      projectId: p1,
      name: "خالد عبدالله العتيبي",
      specialty: "أنظمة كهربائية",
      phone: "0559876543",
      email: null,
      status: "active",
      notes: null,
      rating: { workQuality: 78, scheduleCompliance: 70, safetyStandards: 88, executionSpeed: 75, average: 78, updatedAt: now },
      createdAt: now,
    },
    {
      id: randomUUID(),
      projectId: p2,
      name: "فهد سعد القحطاني",
      specialty: "أعمال تشطيبات",
      phone: "0564567890",
      email: "fahad@example.com",
      status: "active",
      notes: null,
      rating: null,
      createdAt: now,
    },
  ],
  documents: [
    {
      id: randomUUID(),
      projectId: p1,
      name: "المخططات المعمارية",
      type: "pdf",
      url: "/uploads/arch-plans.pdf",
      size: 2048000,
      notes: "الإصدار الأولي المعتمد",
      revisions: [
        { revNumber: 0, url: "/uploads/arch-plans-rev0.pdf", notes: "الإصدار الأولي", approvalStatus: "approved", uploadedAt: "2024-02-01T10:00:00Z" },
        { revNumber: 1, url: "/uploads/arch-plans-rev1.pdf", notes: "تعديلات بعد ملاحظات المالك", approvalStatus: "approved", uploadedAt: "2024-04-15T10:00:00Z" },
      ],
      currentRevision: 1,
      approvalStatus: "approved",
      createdAt: "2024-02-01T10:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p1,
      name: "تقرير فحص التربة",
      type: "pdf",
      url: "/uploads/soil-report.pdf",
      size: 512000,
      notes: null,
      revisions: [
        { revNumber: 0, url: "/uploads/soil-report-rev0.pdf", notes: "التقرير الأولي", approvalStatus: "approved", uploadedAt: "2024-01-20T08:00:00Z" },
      ],
      currentRevision: 0,
      approvalStatus: "approved",
      createdAt: "2024-01-20T08:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p2,
      name: "مخططات التنسيق",
      type: "pdf",
      url: "/uploads/coord-plans.pdf",
      size: 1024000,
      notes: "تحت المراجعة",
      revisions: [
        { revNumber: 0, url: "/uploads/coord-plans-rev0.pdf", notes: "الإصدار الأولي", approvalStatus: "under_review", uploadedAt: "2024-07-10T10:00:00Z" },
      ],
      currentRevision: 0,
      approvalStatus: "under_review",
      createdAt: "2024-07-10T10:00:00Z",
    },
  ],
  meetings: [
    {
      id: randomUUID(),
      projectId: p1,
      title: "اجتماع المتابعة الأسبوعي",
      date: "2025-01-20",
      location: "مقر المشروع",
      attendees: ["م. أحمد الزهراني", "م. خالد العتيبي", "المهندس المشرف"],
      agenda: "مراجعة تقدم الأعمال والمشكلات المستجدة",
      notes: "تم الاتفاق على تسريع أعمال الطوابق العليا",
      createdAt: now,
    },
    {
      id: randomUUID(),
      projectId: p2,
      title: "اجتماع الإطلاق",
      date: "2024-06-15",
      location: "مكتب المالك",
      attendees: ["المالك", "المستشار", "المقاول الرئيسي"],
      agenda: "مناقشة خطة المشروع والجدول الزمني",
      notes: null,
      createdAt: now,
    },
  ],
  letters: [
    {
      id: randomUUID(),
      projectId: p1,
      subject: "طلب الموافقة على المخططات التنفيذية",
      direction: "outgoing",
      from: "مكتب الاستشارات الهندسية",
      to: "مجموعة الخليج العقارية",
      date: "2025-01-10",
      reference: "REF-2025-001",
      autoRef: "LTR-2025-001",
      recipients: ["owner"],
      distributionStatus: "received",
      notes: "يرجى الرد خلال أسبوعين",
      fileUrl: null,
      createdAt: "2025-01-10T08:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p1,
      subject: "ملاحظات على تقرير الفحص الأسبوعي",
      direction: "incoming",
      from: "مجموعة الخليج العقارية",
      to: "مكتب الاستشارات الهندسية",
      date: "2025-01-15",
      reference: "REF-2025-002",
      autoRef: "LTR-2025-002",
      recipients: ["consultant"],
      distributionStatus: "received",
      notes: null,
      fileUrl: null,
      createdAt: "2025-01-15T10:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p2,
      subject: "طلب تمديد الجدول الزمني",
      direction: "incoming",
      from: "شركة الإنشاءات الحديثة",
      to: "مكتب الاستشارات",
      date: "2025-02-01",
      reference: null,
      autoRef: "LTR-2025-003",
      recipients: ["consultant", "owner"],
      distributionStatus: "sent",
      notes: "تأخير بسبب الأمطار",
      fileUrl: null,
      createdAt: "2025-02-01T09:00:00Z",
    },
  ],
  notifications: [
    {
      id: randomUUID(),
      title: "تنبيه: مستند قيد المراجعة",
      message: "مخططات التنسيق في مجمع الواحة السكني قيد المراجعة منذ أكثر من 5 أيام",
      type: "warning",
      scheduledAt: null,
      read: false,
      projectId: p2,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: randomUUID(),
      title: "عقد يقترب من انتهائه",
      message: "عقد الأنظمة الكهربائية في برج الأعمال المركزي ينتهي خلال 60 يوم",
      type: "reminder",
      scheduledAt: null,
      read: false,
      projectId: p1,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ],
  finance: [
    {
      id: randomUUID(),
      title: "دفعة تحصيل - برج الأعمال",
      amount: 2500000,
      type: "income",
      category: "دفعات المشاريع",
      date: "2025-01-05",
      reminderDate: null,
      notes: "الدفعة الثالثة حسب الجدول",
      projectId: p1,
      createdAt: new Date(Date.now() - 8640000000).toISOString(),
    },
    {
      id: randomUUID(),
      title: "رسوم استشارية - يناير",
      amount: 45000,
      type: "expense",
      category: "رسوم حكومية",
      date: "2024-11-01",
      reminderDate: "2025-11-01",
      notes: "تجديد سنوي في نوفمبر",
      projectId: p1,
      createdAt: new Date(Date.now() - 6912000000).toISOString(),
    },
    {
      id: randomUUID(),
      title: "دفعة تحصيل - مجمع الواحة",
      amount: 850000,
      type: "income",
      category: "دفعات المشاريع",
      date: "2025-02-20",
      reminderDate: null,
      notes: "الدفعة الثانية حسب الجدول الزمني",
      projectId: p2,
      createdAt: new Date(Date.now() - 3888000000).toISOString(),
    },
    {
      id: randomUUID(),
      title: "رواتب الفريق - مارس 2025",
      amount: 120000,
      type: "expense",
      category: "رواتب",
      date: "2025-03-31",
      reminderDate: "2025-04-30",
      notes: "تذكير بموعد رواتب أبريل",
      projectId: null,
      createdAt: new Date(Date.now() - 2592000000).toISOString(),
    },
    {
      id: randomUUID(),
      title: "ضريبة القيمة المضافة Q1 2025",
      amount: 187500,
      type: "expense",
      category: "ضرائب",
      date: "2025-04-15",
      reminderDate: new Date(Date.now() + 864000000 * 3).toISOString().split("T")[0],
      notes: "موعد تسديد الضريبة الفصل القادم",
      projectId: null,
      createdAt: new Date(Date.now() - 1296000000).toISOString(),
    },
  ],
  // Prompt 5: Contacts per project
  contacts: [
    {
      id: randomUUID(),
      projectId: p1,
      name: "عبدالرحمن الأحمد",
      role: "owner",
      phone: "0551234567",
      email: "a.ahmed@khalijrealestate.com",
      notes: "المدير التنفيذي - الجهة المالكة",
      createdAt: now,
    },
    {
      id: randomUUID(),
      projectId: p1,
      name: "م. سلمى الهاشمي",
      role: "consultant",
      phone: "0507654321",
      email: "s.hashmi@consult.com",
      notes: "المستشار الهندسي الرئيسي",
      createdAt: now,
    },
    {
      id: randomUUID(),
      projectId: p1,
      name: "شركة البناء المتحدة",
      role: "contractor",
      phone: "0112345678",
      email: "info@unitedbuild.com",
      notes: "المقاول الرئيسي",
      createdAt: now,
    },
    {
      id: randomUUID(),
      projectId: p2,
      name: "م. نورة القرشي",
      role: "consultant",
      phone: "0549876543",
      email: "n.qurashi@techoffice.com",
      notes: "رئيسة المكتب الفني",
      createdAt: now,
    },
  ],
  // Prompt 7: Audit log
  auditLogs: [
    {
      id: randomUUID(),
      userId: "admin",
      userLabel: "مدير النظام",
      action: "create",
      entity: "project",
      entityId: p1,
      description: `إنشاء مشروع: برج الأعمال المركزي`,
      timestamp: "2024-01-10T08:00:00Z",
    },
    {
      id: randomUUID(),
      userId: "admin",
      userLabel: "مدير النظام",
      action: "create",
      entity: "project",
      entityId: p2,
      description: `إنشاء مشروع: مجمع الواحة السكني`,
      timestamp: "2024-05-20T09:00:00Z",
    },
  ],
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

// Initialize counter based on existing letters
counters.letterRef = store.letters.length;

export function newId() {
  return randomUUID();
}

// Prompt 7: Add audit log entry helper
export function addAuditLog(
  userId: string,
  userLabel: string,
  action: "create" | "update" | "delete",
  entity: string,
  entityId: string,
  description: string
) {
  store.auditLogs.unshift({
    id: randomUUID(),
    userId,
    userLabel,
    action,
    entity,
    entityId,
    description,
    timestamp: new Date().toISOString(),
  });
  // Keep max 500 entries
  if (store.auditLogs.length > 500) store.auditLogs.splice(500);
}
