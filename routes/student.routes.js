import express from "express";
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../controllers/student.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Search & list students (Principal, Teacher, SuperAdmin)
router.get("/", authorize("principal", "teacher", "superadmin"), getStudents);
router.get("/:id", getStudentById);

// Principal only management
router.post("/", authorize("principal", "superadmin"), createStudent);
router.put("/:id", authorize("principal", "superadmin"), updateStudent);
router.delete("/:id", authorize("principal", "superadmin"), deleteStudent);

export default router;
