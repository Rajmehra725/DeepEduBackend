import express from "express";
import {
  exportStudents,
  exportAttendance,
  exportFees,
  getPrincipalDashboardStats,
} from "../controllers/report.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant, authorize("principal", "superadmin"));

router.get("/students/export", exportStudents);
router.get("/attendance/export", exportAttendance);
router.get("/fees/export", exportFees);
router.get("/principal-stats", getPrincipalDashboardStats);

export default router;
