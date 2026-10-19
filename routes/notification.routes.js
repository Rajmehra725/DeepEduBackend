import express from "express";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getMyNotifications);
router.put("/:id/read", markAsRead);
router.put("/read-all", markAllAsRead);

export default router;
