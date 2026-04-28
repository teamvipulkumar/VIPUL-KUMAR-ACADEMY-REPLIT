import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({
  limit: "20mb",
  verify: (req, _res, buf) => {
    // Capture raw body for webhook signature verification (Cashfree, Stripe, etc.)
    (req as { rawBody?: string }).rawBody = buf.toString("utf8");
  },
}));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Uploaded files now live in Supabase Storage (public bucket "uploads"). New
// uploads return absolute Supabase URLs directly, so no /api/files/* proxy is
// needed. Legacy DB rows pointing at /api/files/<name> are redirected here so
// any cached HTML keeps working until those rows are rewritten.
const SUPABASE_URL = process.env.SUPABASE_URL;
if (SUPABASE_URL) {
  app.get("/api/files/:filename", (req, res) => {
    const fn = String(req.params.filename ?? "");
    if (!fn || fn.includes("..") || fn.includes("/")) {
      res.status(400).send("Invalid filename"); return;
    }
    res.redirect(302, `${SUPABASE_URL}/storage/v1/object/public/uploads/${encodeURIComponent(fn)}`);
  });
}

app.use("/api", router);

export default app;
