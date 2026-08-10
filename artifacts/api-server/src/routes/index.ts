import { Router, type IRouter } from "express";
import healthRouter from "./health";
import saRouter from "./sa/index";
import demoAuthRouter from "./demo-auth";

const router: IRouter = Router();

router.use(healthRouter);
// Demo auth must be mounted BEFORE the SA router (which applies requireAuth globally)
router.use(demoAuthRouter);
router.use(saRouter);

export default router;
