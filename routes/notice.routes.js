import express from "express";
import {
  getNotices,
  createNotice,
  deleteNotice,
} from "../controllers/notice.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

router.get("/", getNotices);
router.post("/", authorize("principal", "superadmin"), createNotice);
router.delete("/:id", authorize("principal", "superadmin"), deleteNotice);

export default router;
