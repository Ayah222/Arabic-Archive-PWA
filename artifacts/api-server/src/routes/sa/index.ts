import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../../middleware/auth";
import projectsRouter from "./projects";
import contractsRouter from "./contracts";
import contractorsRouter from "./contractors";
import documentsRouter from "./documents";
import meetingsRouter from "./meetings";
import lettersRouter from "./letters";
import dashboardRouter from "./dashboard";
import notificationsRouter from "./notifications";
import voiceRouter from "./voice";
import uploadRouter from "./upload";
import financeRouter from "./finance";
import globalRouter from "./global";
import contactsRouter from "./contacts";
import reportsRouter from "./reports";
import usersRouter from "./users";
import auditRouter from "./audit";
import photosRouter from "./photos";
import attachmentsRouter from "./attachments";
import categoriesRouter from "./categories";

const router: IRouter = Router();

// ── Global auth guard: every /api/sa/* route requires a valid Supabase JWT ──
router.use(requireAuth);

// ── After auth succeeds, overwrite the spoofable audit headers with the
//    verified identity from the JWT so existing route handlers stay unchanged ──
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.authUser) {
    req.headers["x-user-id"] = req.authUser.id;
    req.headers["x-user-label"] = req.authUser.name;
  }
  next();
});

router.use(dashboardRouter);
router.use(notificationsRouter);
router.use(projectsRouter);
router.use(contractsRouter);
router.use(contractorsRouter);
router.use(documentsRouter);
router.use(meetingsRouter);
router.use(lettersRouter);
router.use(voiceRouter);
router.use(uploadRouter);
router.use(financeRouter);
router.use(globalRouter);
router.use(contactsRouter);
router.use(reportsRouter);
router.use(usersRouter);
router.use(auditRouter);
router.use(photosRouter);
router.use(attachmentsRouter);
router.use(categoriesRouter);

export default router;
