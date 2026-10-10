import express from "express";
import {
  getAdminMetrics,
  getAdminUsers,
  toggleSuspendUser,
  toggleBanUser,
  createAnnouncement,
  getAnnouncements,
  getAuditLogs,
} from "../controllers/admin.controller.js";
import { protect, adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// Admin Dashboard & metrics
router.get("/metrics", protect, adminOnly, getAdminMetrics);

// User moderation
router.get("/users", protect, adminOnly, getAdminUsers);
router.put("/users/:userId/suspend", protect, adminOnly, toggleSuspendUser);
router.put("/users/:userId/ban", protect, adminOnly, toggleBanUser);

// Announcements
router.post("/announcements", protect, adminOnly, createAnnouncement);
router.get("/announcements", protect, getAnnouncements); // Public for users

// Audit logs
router.get("/audit-logs", protect, adminOnly, getAuditLogs);

export default router;
