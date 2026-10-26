import express from "express";
import {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getMyAssignedClasses,
  importTeachersCSV,
} from "../controllers/teacher.controller.js";
import { submitTeacherRegistrationRequest } from "../controllers/approvalCenter.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";
import { verifyCaptcha } from "../middleware/captcha.js";

const router = express.Router();

// Public: Teacher self-registration request
router.post("/register-request", verifyCaptcha, submitTeacherRegistrationRequest);

router.use(authenticate, requireTenant);

// Assigned classes shortcut for logged-in teacher
router.get("/my-classes", authorize("teacher", "principal"), getMyAssignedClasses);

// Search & list teachers (Principal, Teacher, SuperAdmin)
router.get("/", authorize("principal", "teacher", "superadmin"), getTeachers);
router.get("/:id", authorize("principal", "teacher", "superadmin"), getTeacherById);

// Principal only management
router.post("/", authorize("principal", "superadmin"), createTeacher);
router.post("/import-csv", authorize("principal", "superadmin"), importTeachersCSV);
router.put("/:id", authorize("principal", "superadmin"), updateTeacher);
router.delete("/:id", authorize("principal", "superadmin"), deleteTeacher);

export default router;
