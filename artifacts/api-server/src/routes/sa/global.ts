import { Router, type IRouter } from "express";
import {
  listProjects,
  listAllContractors,
  listAllContracts,
  listAllMeetings,
  listAllLetters,
  allAttachments,
  allCategories,
  listAllDocuments,
  listFinance,
} from "./archiveDb";

const router: IRouter = Router();

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value: unknown) {
  return normalizeSearchText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function searchableVariants(value: unknown) {
  const normalized = normalizeSearchText(value);
  const variants = new Set([normalized, compactSearchText(normalized)]);
  const date = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (date) {
    const [, year, rawMonth, rawDay] = date;
    const month = Number(rawMonth);
    const day = Number(rawDay);
    [
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      `${day}/${month}/${year}`,
      `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
      `${day}-${month}-${year}`,
      `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`,
    ].forEach(item => {
      variants.add(item);
      variants.add(compactSearchText(item));
    });
  }
  return variants;
}

router.get("/sa/all/contractors", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.toLowerCase();
  const [contractors, projects] = await Promise.all([listAllContractors(), listProjects()]);
  let list = contractors;
  if (q) list = list.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.specialty.toLowerCase().includes(q)
  );
  const withProject = list.map(c => ({
    ...c,
    projectName: projects.find(p => p.id === c.projectId)?.name ?? "—",
  }));
  res.json(withProject);
});

router.get("/sa/all/contracts", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.toLowerCase();
  const [contracts, projects] = await Promise.all([listAllContracts(), listProjects()]);
  let list = contracts;
  if (q) list = list.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.party.toLowerCase().includes(q)
  );
  const withProject = list.map(c => ({
    ...c,
    projectName: projects.find(p => p.id === c.projectId)?.name ?? "—",
  }));
  res.json(withProject);
});

router.get("/sa/all/meetings", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.toLowerCase();
  const [meetings, projects] = await Promise.all([listAllMeetings(), listProjects()]);
  let list = meetings;
  if (q) list = list.filter(m =>
    m.title.toLowerCase().includes(q) ||
    (m.location ?? "").toLowerCase().includes(q)
  );
  const withProject = list.map(m => ({
    ...m,
    projectName: projects.find(p => p.id === m.projectId)?.name ?? "—",
  }));
  res.json(withProject.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
});

router.get("/sa/all/letters", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.toLowerCase();
  const [letters, projects] = await Promise.all([listAllLetters(), listProjects()]);
  let list = letters;
  if (q) list = list.filter(l =>
    l.subject.toLowerCase().includes(q) ||
    l.from.toLowerCase().includes(q) ||
    l.to.toLowerCase().includes(q)
  );
  const withProject = list.map(l => ({
    ...l,
    projectName: projects.find(p => p.id === l.projectId)?.name ?? "—",
  }));
  res.json(withProject.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
});

router.get("/sa/search", async (req, res): Promise<void> => {
  const q = normalizeSearchText(req.query.q);
  const compactQ = compactSearchText(q);
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  if (!q && !from && !to) {
    res.json({ projects: [], contractors: [], contracts: [], meetings: [], letters: [], attachments: [], documents: [], finance: [] });
    return;
  }

  const [projects, contractors, contracts, meetings, letters, attachments, categories, documents, finance] = await Promise.all([
    listProjects(),
    listAllContractors(),
    listAllContracts(),
    listAllMeetings(),
    listAllLetters(),
    allAttachments(),
    allCategories(),
    listAllDocuments(),
    listFinance(),
  ]);

  const textMatch = (...values: unknown[]) => !q || values.some(value =>
    [...searchableVariants(value)].some(variant =>
      variant.includes(q) || (compactQ.length > 1 && variant.includes(compactQ))
    )
  );
  const dateMatch = (...values: Array<string | null | undefined>) => {
    if (!from && !to) return true;
    return values.some(value => {
      if (!value) return false;
      const day = value.slice(0, 10);
      return (!from || day >= from) && (!to || day <= to);
    });
  };

  res.json({
    projects: projects.filter(p =>
      textMatch(p.id, p.name, p.client, p.description, p.location, p.startDate, p.endDate, p.createdAt, p.updatedAt) &&
      dateMatch(p.startDate, p.endDate, p.createdAt, p.updatedAt)
    ),
    contractors: contractors.filter(c =>
      textMatch(c.id, c.name, c.specialty, c.phone, c.email, c.notes, c.createdAt) &&
      dateMatch(c.createdAt)
    ).map(c => ({ ...c, projectName: projects.find(p => p.id === c.projectId)?.name ?? "—" })),
    contracts: contracts.filter(c =>
      textMatch(c.id, c.title, c.party, c.notes, c.startDate, c.endDate, c.createdAt) &&
      dateMatch(c.startDate, c.endDate, c.createdAt)
    ).map(c => ({ ...c, projectName: projects.find(p => p.id === c.projectId)?.name ?? "—" })),
    meetings: meetings.filter(m =>
      textMatch(m.id, m.title, m.agenda, m.notes, m.location, m.date, m.createdAt, ...m.attendees) &&
      dateMatch(m.date, m.createdAt)
    ).map(m => ({ ...m, projectName: projects.find(p => p.id === m.projectId)?.name ?? "—" })),
    letters: letters.filter(l =>
      textMatch(l.id, l.subject, l.from, l.to, l.reference, l.autoRef, l.notes, l.date, l.createdAt) &&
      dateMatch(l.date, l.createdAt)
    ).map(l => ({ ...l, projectName: projects.find(p => p.id === l.projectId)?.name ?? "—" })),
    attachments: attachments.filter(a =>
      textMatch(a.id, a.name, a.customType, a.uploadedAt) && dateMatch(a.uploadedAt)
    ).map(a => ({
      ...a,
      projectName: projects.find(p => p.id === a.projectId)?.name ?? "—",
      categoryName: categories.find(c => c.id === a.entityId)?.name,
    })),
    documents: documents.filter(d =>
      textMatch(
        d.id,
        d.name,
        d.docRef,
        d.notes,
        d.createdAt,
        d.approvalStatus,
        ...d.revisions.flatMap(revision => [revision.revNumber, revision.uploadedAt]),
      ) && dateMatch(d.createdAt, ...d.revisions.map(revision => revision.uploadedAt))
    ).map(d => ({ ...d, projectName: projects.find(p => p.id === d.projectId)?.name ?? "—" })),
    finance: finance.filter(record =>
      textMatch(
        record.id,
        record.title,
        record.amount,
        record.category,
        record.type,
        record.notes,
        record.date,
        record.reminderDate,
        record.createdAt,
      ) && dateMatch(record.date, record.reminderDate, record.createdAt)
    ).map(record => ({
      ...record,
      projectName: record.projectId
        ? projects.find(project => project.id === record.projectId)?.name ?? "—"
        : "عام",
    })),
  });
});

export default router;
