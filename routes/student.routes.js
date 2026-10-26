import express from "express";
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  importStudentsCSV,
  linkParentStudent,
} from "../controllers/student.controller.js";
import { submitStudentRegistrationRequest } from "../controllers/approvalCenter.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";
import { verifyCaptcha } from "../middleware/captcha.js";

const router = express.Router();

// Public: Student self-registration admission request
router.post("/register-request", verifyCaptcha, submitStudentRegistrationRequest);

router.use(authenticate, requireTenant);

// Search & list students (Principal, Teacher, SuperAdmin)
router.get("/", authorize("principal", "teacher", "superadmin"), getStudents);
router.get("/:id", getStudentById);

// Principal only management
router.post("/", authorize("principal", "superadmin"), createStudent);
router.post("/import-csv", authorize("principal", "superadmin"), importStudentsCSV);
router.post("/link-parent", authorize("principal", "superadmin"), linkParentStudent);
router.put("/:id", authorize("principal", "superadmin"), updateStudent);
router.delete("/:id", authorize("principal", "superadmin"), deleteStudent);

export default router;
