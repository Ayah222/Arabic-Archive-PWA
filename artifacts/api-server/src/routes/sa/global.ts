import { Router, type IRouter } from "express";
import { store } from "./store";

const router: IRouter = Router();

router.get("/sa/all/contractors", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.toLowerCase();
  let list = [...store.contractors];
  if (q) list = list.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.specialty.toLowerCase().includes(q)
  );
  const withProject = list.map(c => ({
    ...c,
    projectName: store.projects.find(p => p.id === c.projectId)?.name ?? "—",
  }));
  res.json(withProject);
});

router.get("/sa/all/contracts", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.toLowerCase();
  let list = [...store.contracts];
  if (q) list = list.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.party.toLowerCase().includes(q)
  );
  const withProject = list.map(c => ({
    ...c,
    projectName: store.projects.find(p => p.id === c.projectId)?.name ?? "—",
  }));
  res.json(withProject);
});

router.get("/sa/all/meetings", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.toLowerCase();
  let list = [...store.meetings];
  if (q) list = list.filter(m =>
    m.title.toLowerCase().includes(q) ||
    (m.location ?? "").toLowerCase().includes(q)
  );
  const withProject = list.map(m => ({
    ...m,
    projectName: store.projects.find(p => p.id === m.projectId)?.name ?? "—",
  }));
  res.json(withProject.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
});

router.get("/sa/all/letters", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.toLowerCase();
  let list = [...store.letters];
  if (q) list = list.filter(l =>
    l.subject.toLowerCase().includes(q) ||
    l.from.toLowerCase().includes(q) ||
    l.to.toLowerCase().includes(q)
  );
  const withProject = list.map(l => ({
    ...l,
    projectName: store.projects.find(p => p.id === l.projectId)?.name ?? "—",
  }));
  res.json(withProject.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
});

router.get("/sa/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.toLowerCase() ?? "";
  if (!q) { res.json({ projects: [], contractors: [], contracts: [], meetings: [], letters: [] }); return; }
  res.json({
    projects: store.projects.filter(p =>
      p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    ),
    contractors: store.contractors.filter(c =>
      c.name.toLowerCase().includes(q) || c.specialty.toLowerCase().includes(q)
    ).map(c => ({ ...c, projectName: store.projects.find(p => p.id === c.projectId)?.name ?? "—" })),
    contracts: store.contracts.filter(c =>
      c.title.toLowerCase().includes(q) || c.party.toLowerCase().includes(q)
    ).map(c => ({ ...c, projectName: store.projects.find(p => p.id === c.projectId)?.name ?? "—" })),
    meetings: store.meetings.filter(m =>
      m.title.toLowerCase().includes(q) || (m.agenda ?? "").toLowerCase().includes(q)
    ).map(m => ({ ...m, projectName: store.projects.find(p => p.id === m.projectId)?.name ?? "—" })),
    letters: store.letters.filter(l =>
      l.subject.toLowerCase().includes(q) || l.from.toLowerCase().includes(q) || l.to.toLowerCase().includes(q)
    ).map(l => ({ ...l, projectName: store.projects.find(p => p.id === l.projectId)?.name ?? "—" })),
  });
});

export default router;
