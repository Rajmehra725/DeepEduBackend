import express from "express";
import {
  getDashboardStats,
  getSchools,
  createSchool,
  updateSchoolStatus,
  updateSubscription,
} from "../controllers/superadmin.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";

const router = express.Router();

router.use(authenticate, authorize("superadmin"));

router.get("/dashboard", getDashboardStats);
router.get("/schools", getSchools);
router.post("/schools", createSchool);
router.put("/schools/:id/status", updateSchoolStatus);
router.put("/schools/:id/subscription", updateSubscription);

export default router;
