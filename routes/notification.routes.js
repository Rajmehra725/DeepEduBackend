import express from "express";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  registerDeviceToken,
  unregisterDeviceToken,
  broadcastNotification,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate);

// In-app notifications inbox
router.get("/", getMyNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);

// Mobile device push token lifecycle
router.post("/register-device", registerDeviceToken);
router.post("/unregister-device", unregisterDeviceToken);

// Administrative announcement dispatch
router.post("/broadcast", requireTenant, authorize("principal", "superadmin"), broadcastNotification);

export default router;
