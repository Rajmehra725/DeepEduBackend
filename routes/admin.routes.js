import express from "express";
import {
  getAdminMetrics,
  getAdminAnalytics,
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUser,
  toggleSuspendUser,
  toggleBanUser,
  deleteAdminUser,
  changeUserRole,
  getAdminAccounts,
  getAdminGroups,
  getAdminGroupDetails,
  createAdminGroup,
  updateAdminGroup,
  deleteAdminGroup,
  addAdminGroupMember,
  removeAdminGroupMember,
  getAdminMoments,
  deleteAdminMoment,
  getAdminNotifications,
  createAdminNotification,
  updateAdminNotification,
  deleteAdminNotification,
  sendAdminNotification,
  cancelAdminNotification,
  getAdminSettings,
  updateAdminSetting,
  getAdminCards,
  updateAdminCardStatus,
  deleteAdminCard,
  getAuditLogs,
  createAnnouncement,
  getAnnouncements,
} from "../controllers/admin.controller.js";
import { protect, adminOnly, superAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// 1. Dashboard Metrics & Analytics
router.get("/metrics", protect, adminOnly, getAdminMetrics);
router.get("/analytics", protect, adminOnly, getAdminAnalytics);

// 2. User Management
router.get("/users", protect, adminOnly, getAdminUsers);
router.get("/users/:userId", protect, adminOnly, getAdminUserDetails);
router.put("/users/:userId", protect, adminOnly, updateAdminUser);
router.put("/users/:userId/suspend", protect, adminOnly, toggleSuspendUser);
router.put("/users/:userId/ban", protect, adminOnly, toggleBanUser);
router.delete("/users/:userId", protect, superAdminOnly, deleteAdminUser);
router.put("/users/:userId/role", protect, superAdminOnly, changeUserRole);

// 3. Admin Accounts & Roles
router.get("/admins", protect, adminOnly, getAdminAccounts);

// 4. Group Management
router.get("/groups", protect, adminOnly, getAdminGroups);
router.get("/groups/:groupId", protect, adminOnly, getAdminGroupDetails);
router.post("/groups", protect, adminOnly, createAdminGroup);
router.put("/groups/:groupId", protect, adminOnly, updateAdminGroup);
router.delete("/groups/:groupId", protect, adminOnly, deleteAdminGroup);
router.post("/groups/:groupId/members", protect, adminOnly, addAdminGroupMember);
router.delete("/groups/:groupId/members/:memberId", protect, adminOnly, removeAdminGroupMember);

// 5. Moments Moderation
router.get("/moments", protect, adminOnly, getAdminMoments);
router.delete("/moments/:momentId", protect, adminOnly, deleteAdminMoment);

// 6. Notification Campaigns & Announcements CRUD
router.get("/notifications", protect, adminOnly, getAdminNotifications);
router.post("/notifications", protect, adminOnly, createAdminNotification);
router.put("/notifications/:id", protect, adminOnly, updateAdminNotification);
router.delete("/notifications/:id", protect, adminOnly, deleteAdminNotification);
router.post("/notifications/:id/send", protect, adminOnly, sendAdminNotification);
router.post("/notifications/:id/cancel", protect, adminOnly, cancelAdminNotification);

// Legacy announcements compatibility
router.post("/announcements", protect, adminOnly, createAnnouncement);
router.get("/announcements", protect, getAnnouncements);

// 7. System Settings CRUD
router.get("/settings", protect, adminOnly, getAdminSettings);
router.put("/settings/:key", protect, adminOnly, updateAdminSetting);

// 8. Content Management (Cards CMS)
router.get("/cards", protect, adminOnly, getAdminCards);
router.put("/cards/:id/status", protect, adminOnly, updateAdminCardStatus);
router.delete("/cards/:id", protect, adminOnly, deleteAdminCard);

// 9. Audit Logs
router.get("/audit-logs", protect, adminOnly, getAuditLogs);

export default router;
