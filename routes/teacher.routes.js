import express from "express";
import {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getMyAssignedClasses,
  getTeacherDashboardStats,
  importTeachersCSV,
  getMyTeacherProfile,
  updateMyTeacherProfile,
  uploadMyTeacherPhoto,
  uploadMyTeacherDocument,
  deleteMyTeacherDocument,
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

// Logged-in teacher profile, documents, and credentials management
router.get("/me/profile", authorize("teacher", "principal"), getMyTeacherProfile);
router.put("/me/profile", authorize("teacher", "principal"), updateMyTeacherProfile);
router.post("/me/photo", authorize("teacher", "principal"), uploadMyTeacherPhoto);
router.post("/me/documents", authorize("teacher", "principal"), uploadMyTeacherDocument);
router.delete("/me/documents/:docId", authorize("teacher", "principal"), deleteMyTeacherDocument);

// Assigned classes and dashboard metrics shortcut for logged-in teacher
router.get("/my-classes", authorize("teacher", "principal"), getMyAssignedClasses);
router.get("/dashboard-stats", authorize("teacher", "principal"), getTeacherDashboardStats);

// Search & list teachers (Principal, Teacher, SuperAdmin)
router.get("/", authorize("principal", "teacher", "superadmin"), getTeachers);
router.get("/:id", authorize("principal", "teacher", "superadmin"), getTeacherById);

// Principal only management
router.post("/", authorize("principal", "superadmin"), createTeacher);
router.post("/import-csv", authorize("principal", "superadmin"), importTeachersCSV);
router.put("/:id", authorize("principal", "superadmin"), updateTeacher);
router.delete("/:id", authorize("principal", "superadmin"), deleteTeacher);

export default router;
