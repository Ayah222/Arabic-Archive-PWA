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
  if (!q) { res.json({ projects: [], contractors: [], contracts: [], meetings: [], letters: [], attachments: [] }); return; }

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

  res.json({
    projects: projects.filter(p =>
      p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    ),
    contractors: contractors.filter(c =>
      c.name.toLowerCase().includes(q) || c.specialty.toLowerCase().includes(q)
    ).map(c => ({ ...c, projectName: projects.find(p => p.id === c.projectId)?.name ?? "—" })),
    contracts: contracts.filter(c =>
      c.title.toLowerCase().includes(q) || c.party.toLowerCase().includes(q)
    ).map(c => ({ ...c, projectName: projects.find(p => p.id === c.projectId)?.name ?? "—" })),
    meetings: meetings.filter(m =>
      m.title.toLowerCase().includes(q) || (m.agenda ?? "").toLowerCase().includes(q)
    ).map(m => ({ ...m, projectName: projects.find(p => p.id === m.projectId)?.name ?? "—" })),
    letters: letters.filter(l =>
      l.subject.toLowerCase().includes(q) || l.from.toLowerCase().includes(q) || l.to.toLowerCase().includes(q)
    ).map(l => ({ ...l, projectName: projects.find(p => p.id === l.projectId)?.name ?? "—" })),
    attachments: attachments.filter(a =>
      a.name.toLowerCase().includes(q) || a.customType.toLowerCase().includes(q)
    ).map(a => ({
      ...a,
      projectName: projects.find(p => p.id === a.projectId)?.name ?? "—",
      categoryName: categories.find(c => c.id === a.entityId)?.name,
    })),
    documents: documents.filter(d =>
      d.name.toLowerCase().includes(q) || (d.notes ?? "").toLowerCase().includes(q)
    ).map(d => ({ ...d, projectName: projects.find(p => p.id === d.projectId)?.name ?? "—" })),
  });
});

export default router;
