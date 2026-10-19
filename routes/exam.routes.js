import express from "express";
import {
  getExams,
  createExam,
  getMarks,
  saveMarks,
  publishExam,
  getStudentReportCard,
} from "../controllers/exam.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

router.get("/", getExams);
router.post("/", authorize("principal", "superadmin"), createExam);
router.get("/:examId/marks", authorize("principal", "teacher", "superadmin"), getMarks);
router.post("/:examId/marks", authorize("principal", "teacher", "superadmin"), saveMarks);
router.put("/:examId/publish", authorize("principal", "superadmin"), publishExam);
router.get("/report-card", getStudentReportCard);

export default router;
