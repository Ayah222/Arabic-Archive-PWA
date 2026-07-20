import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

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

export default router;
