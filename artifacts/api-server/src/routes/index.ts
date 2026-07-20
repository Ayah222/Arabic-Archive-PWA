import { Router, type IRouter } from "express";
import healthRouter from "./health";
import saRouter from "./sa/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(saRouter);

export default router;
