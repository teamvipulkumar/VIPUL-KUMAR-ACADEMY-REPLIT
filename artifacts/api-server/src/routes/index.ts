import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import coursesRouter from "./courses";
import enrollmentsRouter from "./enrollments";
import lessonsRouter from "./lessons";
import paymentsRouter from "./payments";
import affiliatesRouter from "./affiliates";
import adminRouter from "./admin";
import couponsRouter from "./coupons";
import notificationsRouter from "./notifications";
import analyticsRouter from "./analytics";
import uploadRouter from "./upload";
import crmRouter from "./crm";
import gstRouter from "./gst";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/courses", coursesRouter);
router.use("/enrollments", enrollmentsRouter);
router.use("/lessons", lessonsRouter);
router.use("/payments", paymentsRouter);
router.use("/affiliate", affiliatesRouter);
router.use("/admin", adminRouter);
router.use("/coupons", couponsRouter);
router.use("/notifications", notificationsRouter);
router.use("/analytics", analyticsRouter);
router.use("/upload", uploadRouter);
router.use("/admin/crm", crmRouter);
router.use("/admin/gst", gstRouter);

export default router;
