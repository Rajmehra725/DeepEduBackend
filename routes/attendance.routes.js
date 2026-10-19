import express from "express";
import {
  getRoster,
  markAttendance,
  getStudentAttendance,
} from "../controllers/attendance.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Roster retrieval & marking for Teachers and Principals
router.get("/roster", authorize("teacher", "principal", "superadmin"), getRoster);
router.post("/mark", authorize("teacher", "principal", "superadmin"), markAttendance);

// Student attendance history (Student, Parent, Teacher, Principal)
router.get("/student/:studentId", getStudentAttendance);

export default router;
