import express from "express";
import {
  getHomework,
  createHomework,
  updateHomework,
  deleteHomework,
  getHomeworkSubmissions,
  submitHomework,
  evaluateHomeworkSubmission,
} from "../controllers/homework.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

router.get("/", getHomework);
router.post("/", authorize("teacher", "principal", "superadmin"), createHomework);
router.put("/:id", authorize("teacher", "principal", "superadmin"), updateHomework);
router.delete("/:id", authorize("teacher", "principal", "superadmin"), deleteHomework);

// Submissions & Evaluation
router.get("/:id/submissions", authorize("teacher", "principal", "superadmin"), getHomeworkSubmissions);
router.post("/:id/submissions", authorize("student"), submitHomework);
router.put("/:id/submissions/:submissionId/evaluate", authorize("teacher", "principal", "superadmin"), evaluateHomeworkSubmission);

export default router;
