import express from "express";
import {
  getClasses,
  createClass,
  createSection,
  getSubjects,
  createSubject,
  getSessions,
  createSession,
  assignSubjectTeacher,
  getClassAssignments,
} from "../controllers/academic.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Read routes available to Principal, Teacher, SuperAdmin
router.get("/classes", getClasses);
router.get("/subjects", getSubjects);
router.get("/sessions", getSessions);
router.get("/assignments", getClassAssignments);

// Mutation routes restricted to Principal
router.post("/classes", authorize("principal", "superadmin"), createClass);
router.post("/classes/:classId/sections", authorize("principal", "superadmin"), createSection);
router.post("/subjects", authorize("principal", "superadmin"), createSubject);
router.post("/sessions", authorize("principal", "superadmin"), createSession);
router.post("/assign-teacher", authorize("principal", "superadmin"), assignSubjectTeacher);

export default router;
