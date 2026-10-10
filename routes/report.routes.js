import express from "express";
import {
  submitReport,
  getAdminReports,
  resolveReport,
} from "../controllers/report.controller.js";
import { protect, adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// User can submit report
router.post("/submit", protect, submitReport);

// Admin can review and resolve reports
router.get("/admin", protect, adminOnly, getAdminReports);
router.put("/admin/:reportId", protect, adminOnly, resolveReport);

export default router;
