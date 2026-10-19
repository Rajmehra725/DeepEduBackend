import express from "express";
import {
  recordCheckIn,
  getMyAttendanceHistory,
  getSchoolTeacherAttendance,
  reviewTeacherAttendance,
} from "../controllers/teacherAttendance.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Teacher self-service
router.post("/check-in", authorize("teacher"), recordCheckIn);
router.get("/my-history", authorize("teacher"), getMyAttendanceHistory);

// Principal oversight
router.get("/school", authorize("principal", "superadmin"), getSchoolTeacherAttendance);
router.post("/review", authorize("principal", "superadmin"), reviewTeacherAttendance);

export default router;
