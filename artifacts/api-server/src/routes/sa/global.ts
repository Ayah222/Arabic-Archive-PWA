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
} from "./archiveDb";

const router: IRouter = Router();

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
  const q = (req.query.q as string | undefined)?.toLowerCase() ?? "";
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  if (!q && !from && !to) { res.json({ projects: [], contractors: [], contracts: [], meetings: [], letters: [], attachments: [], documents: [] }); return; }

  const [projects, contractors, contracts, meetings, letters, attachments, categories, documents] = await Promise.all([
    listProjects(),
    listAllContractors(),
    listAllContracts(),
    listAllMeetings(),
    listAllLetters(),
    allAttachments(),
    allCategories(),
    listAllDocuments(),
  ]);

  const textMatch = (...values: unknown[]) => !q || values.some(value => String(value ?? "").toLowerCase().includes(q));
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
      textMatch(p.name, p.client, p.description, p.location, p.startDate, p.endDate) &&
      dateMatch(p.startDate, p.endDate, p.createdAt, p.updatedAt)
    ),
    contractors: contractors.filter(c =>
      textMatch(c.name, c.specialty, c.phone, c.email, c.notes, c.createdAt) &&
      dateMatch(c.createdAt)
    ).map(c => ({ ...c, projectName: projects.find(p => p.id === c.projectId)?.name ?? "—" })),
    contracts: contracts.filter(c =>
      textMatch(c.title, c.party, c.notes, c.startDate, c.endDate, c.createdAt) &&
      dateMatch(c.startDate, c.endDate, c.createdAt)
    ).map(c => ({ ...c, projectName: projects.find(p => p.id === c.projectId)?.name ?? "—" })),
    meetings: meetings.filter(m =>
      textMatch(m.title, m.agenda, m.notes, m.location, m.date, ...m.attendees) &&
      dateMatch(m.date, m.createdAt)
    ).map(m => ({ ...m, projectName: projects.find(p => p.id === m.projectId)?.name ?? "—" })),
    letters: letters.filter(l =>
      textMatch(l.subject, l.from, l.to, l.reference, l.autoRef, l.notes, l.date) &&
      dateMatch(l.date, l.createdAt)
    ).map(l => ({ ...l, projectName: projects.find(p => p.id === l.projectId)?.name ?? "—" })),
    attachments: attachments.filter(a =>
      textMatch(a.name, a.customType, a.uploadedAt) && dateMatch(a.uploadedAt)
    ).map(a => ({
      ...a,
      projectName: projects.find(p => p.id === a.projectId)?.name ?? "—",
      categoryName: categories.find(c => c.id === a.entityId)?.name,
    })),
    documents: documents.filter(d =>
      textMatch(d.name, d.docRef, d.notes, d.createdAt, d.approvalStatus) && dateMatch(d.createdAt)
    ).map(d => ({ ...d, projectName: projects.find(p => p.id === d.projectId)?.name ?? "—" })),
  });
});

export default router;
