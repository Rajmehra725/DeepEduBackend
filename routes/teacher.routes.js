import express from "express";
import {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getMyAssignedClasses,
} from "../controllers/teacher.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Assigned classes shortcut for logged-in teacher
router.get("/my-classes", authorize("teacher", "principal"), getMyAssignedClasses);

// Search & list teachers (Principal, Teacher, SuperAdmin)
router.get("/", authorize("principal", "teacher", "superadmin"), getTeachers);
router.get("/:id", authorize("principal", "teacher", "superadmin"), getTeacherById);

// Principal only management
router.post("/", authorize("principal", "superadmin"), createTeacher);
router.put("/:id", authorize("principal", "superadmin"), updateTeacher);
router.delete("/:id", authorize("principal", "superadmin"), deleteTeacher);

export default router;
