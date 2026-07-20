import { randomUUID } from "crypto";

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

export interface SAProjectContractor {
  id: string;
  projectId: string;
  name: string;
  specialty: string;
  phone: string | null;
  email: string | null;
  status: "active" | "inactive";
  notes: string | null;
  createdAt: string;
}

export interface SADocument {
  id: string;
  projectId: string;
  name: string;
  type: "pdf" | "image" | "word" | "excel" | "other";
  url: string;
  size: number | null;
  notes: string | null;
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

export interface SALetter {
  id: string;
  projectId: string;
  subject: string;
  direction: "incoming" | "outgoing";
  from: string;
  to: string;
  date: string;
  reference: string | null;
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
      createdAt: "2023-02-15T07:00:00Z",
      updatedAt: "2024-12-01T08:00:00Z",
    },
  ],
  contracts: [
    {
      id: randomUUID(),
      projectId: p1,
      title: "عقد الإنشاء الرئيسي",
      party: "شركة بناء المستقبل للمقاولات",
      value: 8500000,
      startDate: "2024-02-01",
      endDate: "2025-08-31",
      status: "active",
      notes: "عقد شامل لأعمال الهيكل الإنشائي والتشطيبات الداخلية والخارجية",
      fileUrl: null,
      createdAt: "2024-01-25T08:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p1,
      title: "عقد الأنظمة الكهربائية",
      party: "مؤسسة النور للكهرباء",
      value: 1200000,
      startDate: "2024-06-01",
      endDate: "2025-06-30",
      status: "active",
      notes: "تركيب جميع الأنظمة الكهربائية بما فيها أنظمة الطاقة الشمسية",
      fileUrl: null,
      createdAt: "2024-05-15T09:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p2,
      title: "عقد البنية التحتية",
      party: "مقاولات الأساس المتين",
      value: 4200000,
      startDate: "2024-06-15",
      endDate: "2025-04-30",
      status: "active",
      notes: "أعمال التأسيس والخوازيق وشبكات الصرف والمياه",
      fileUrl: null,
      createdAt: "2024-06-10T10:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p3,
      title: "عقد التجهيزات الطبية",
      party: "شركة الطب التقني",
      value: 6500000,
      startDate: "2023-10-01",
      endDate: "2024-10-31",
      status: "completed",
      notes: "تجهيز وتركيب كافة المعدات الطبية المتخصصة",
      fileUrl: null,
      createdAt: "2023-09-20T08:00:00Z",
    },
  ],
  contractors: [
    {
      id: randomUUID(),
      projectId: p1,
      name: "محمد العمري",
      specialty: "مهندس إنشائي رئيسي",
      phone: "0501234567",
      email: "m.omari@future-build.sa",
      status: "active",
      notes: "مسؤول عن الإشراف الميداني اليومي",
      createdAt: "2024-02-01T08:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p1,
      name: "سعد القحطاني",
      specialty: "مشرف أعمال كهربائية",
      phone: "0557891234",
      email: "s.qahtani@noor-electric.sa",
      status: "active",
      notes: null,
      createdAt: "2024-06-01T08:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p2,
      name: "عبدالله الشمري",
      specialty: "مهندس مدني",
      phone: "0509876543",
      email: "a.shammari@asas.sa",
      status: "active",
      notes: "متخصص في أعمال التأسيس",
      createdAt: "2024-06-15T08:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p3,
      name: "فيصل الدوسري",
      specialty: "مهندس تقنية طبية",
      phone: "0503456789",
      email: "f.dossari@medtech.sa",
      status: "inactive",
      notes: "انتهى العقد بعد اكتمال التجهيزات",
      createdAt: "2023-10-01T08:00:00Z",
    },
  ],
  documents: [
    {
      id: randomUUID(),
      projectId: p1,
      name: "مخططات الطابق الأرضي",
      type: "pdf",
      url: "/uploads/ground-floor-plan.pdf",
      size: 2400000,
      notes: "المخططات الرئيسية المعتمدة من البلدية",
      createdAt: "2024-02-10T09:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p1,
      name: "صورة موقع العمل - يناير",
      type: "image",
      url: "/uploads/site-jan.jpg",
      size: 850000,
      notes: "صورة توثيقية للموقع في بداية المشروع",
      createdAt: "2024-01-20T10:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p2,
      name: "تقرير فحص التربة",
      type: "pdf",
      url: "/uploads/soil-report.pdf",
      size: 1800000,
      notes: "تقرير مختبر التربة لموقع المجمع السكني",
      createdAt: "2024-05-25T11:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p3,
      name: "شهادة إتمام الأعمال",
      type: "pdf",
      url: "/uploads/completion-cert.pdf",
      size: 420000,
      notes: "شهادة إتمام صادرة من الجهة المالكة",
      createdAt: "2024-12-01T08:00:00Z",
    },
  ],
  meetings: [
    {
      id: randomUUID(),
      projectId: p1,
      title: "اجتماع متابعة شهر يناير",
      date: "2025-01-15",
      location: "مقر الشركة الرئيسي",
      attendees: ["محمد العمري", "أحمد الفهد", "خالد الرشيد", "نورة السبيعي"],
      agenda: "مراجعة نسبة الإنجاز والعقبات الميدانية وخطة الشهر القادم",
      notes: "تم الاتفاق على تسريع أعمال الطوابق 10-15 وزيادة طواقم العمل",
      createdAt: "2025-01-15T14:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p1,
      title: "اجتماع مراجعة السلامة",
      date: "2025-02-01",
      location: "موقع المشروع",
      attendees: ["سعد القحطاني", "مشرف السلامة", "محمد العمري"],
      agenda: "مراجعة تقرير السلامة الشهري وإجراءات الوقاية من الحوادث",
      notes: "تم إصدار 3 مخالفات سلامة وتحديد الإجراءات التصحيحية",
      createdAt: "2025-02-01T10:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p2,
      title: "اجتماع تصميم الواجهات",
      date: "2025-01-20",
      location: "مكتب المعماري",
      attendees: ["عبدالله الشمري", "المعماري المصمم", "ممثل المالك"],
      agenda: "مراجعة مقترحات تصميم واجهات المجمع السكني",
      notes: "اعتماد التصميم النهائي للواجهات بعد تعديلات بسيطة",
      createdAt: "2025-01-20T11:00:00Z",
    },
  ],
  letters: [
    {
      id: randomUUID(),
      projectId: p1,
      subject: "طلب تمديد مدة التنفيذ",
      direction: "outgoing",
      from: "مكتب المشروع",
      to: "مجموعة الخليج العقارية",
      date: "2025-01-10",
      reference: "SA-2025-001",
      notes: "طلب تمديد 45 يوم بسبب تأخر توريد مواد البناء",
      fileUrl: null,
      createdAt: "2025-01-10T09:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p1,
      subject: "موافقة على تعديل المخططات",
      direction: "incoming",
      from: "بلدية الرياض",
      to: "مكتب المشروع",
      date: "2025-01-25",
      reference: "MNP-2025-4521",
      notes: "موافقة رسمية على التعديلات المقدمة في مخططات الطابق الأرضي",
      fileUrl: null,
      createdAt: "2025-01-25T11:00:00Z",
    },
    {
      id: randomUUID(),
      projectId: p2,
      subject: "إشعار بدء أعمال الحفر",
      direction: "outgoing",
      from: "مكتب المشروع",
      to: "بلدية جدة",
      date: "2024-07-01",
      reference: "SA-2024-010",
      notes: "إشعار رسمي بموعد بدء أعمال الحفر للموقع",
      fileUrl: null,
      createdAt: "2024-07-01T08:00:00Z",
    },
  ],
  notifications: [
    {
      id: randomUUID(),
      title: "تذكير: اجتماع المتابعة الشهري",
      message: "موعد اجتماع المتابعة لمشروع برج الأعمال المركزي غداً الساعة 10 صباحاً",
      type: "reminder",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      read: false,
      projectId: p1,
      createdAt: now,
    },
    {
      id: randomUUID(),
      title: "تحديث نسبة الإنجاز",
      message: "تم تحديث نسبة إنجاز مشروع مجمع الواحة السكني إلى 42%",
      type: "info",
      scheduledAt: null,
      read: false,
      projectId: p2,
      createdAt: now,
    },
    {
      id: randomUUID(),
      title: "تنبيه: موعد تسليم عقد",
      message: "عقد البنية التحتية لمجمع الواحة السكني ينتهي خلال 90 يوماً",
      type: "warning",
      scheduledAt: null,
      read: true,
      projectId: p2,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: randomUUID(),
      title: "تم إتمام المشروع",
      message: "تم إتمام مشروع المركز الطبي المتخصص بنجاح وتسليمه للعميل",
      type: "success",
      scheduledAt: null,
      read: true,
      projectId: p3,
      createdAt: new Date(Date.now() - 5184000000).toISOString(),
    },
  ],
};

export function newId() {
  return randomUUID();
}
