import express from "express";
import {
  getTimetable,
  addSlot,
  deleteSlot,
} from "../controllers/timetable.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// View timetable
router.get("/", getTimetable);

// Manage timetable (Principal only)
router.post("/slot", authorize("principal", "superadmin"), addSlot);
router.delete("/slot/:id", authorize("principal", "superadmin"), deleteSlot);

export default router;
