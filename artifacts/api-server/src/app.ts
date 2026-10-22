import express, { type Express } from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { GoogleDriveAccessDeniedError } from "./lib/tenantDrive";

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
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "مسار API غير موجود" });
});

const apiErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = error instanceof GoogleDriveAccessDeniedError
    ? error.httpStatus
    : typeof error?.status === "number" && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
  logger.error({ err: error, status }, "API request failed");
  res.status(status).json({
    code: error instanceof GoogleDriveAccessDeniedError ? error.code : undefined,
    error: error instanceof GoogleDriveAccessDeniedError
      ? error.publicMessage
      : status < 500 && error instanceof Error
        ? error.message
        : "تعذر إكمال الطلب. تحقق من إعدادات الخادم وحاول مجدداً.",
  });
};
app.use("/api", apiErrorHandler);

export default app;
