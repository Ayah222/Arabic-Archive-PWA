import express, { type Express } from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startScheduler } from "./routes/sa/scheduler";
import {
  DriveReauthorizationRequiredError,
  DriveTokenRefreshUnavailableError,
} from "./lib/tenantDrive";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
const driveReauthorizationErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (error instanceof DriveReauthorizationRequiredError || error instanceof DriveTokenRefreshUnavailableError) {
    req.log.warn({ tenantId: res.locals.tenantId, code: error.code }, "Google Drive token refresh needs attention");
    res.status(503).json({
      code: error.code,
      error: error.message,
    });
    return;
  }
  next(error);
};
app.use(driveReauthorizationErrorHandler);

export default app;
