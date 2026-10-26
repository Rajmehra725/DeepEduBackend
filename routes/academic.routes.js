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
  getSchoolSettings,
  updateSchoolSettings,
} from "../controllers/academic.controller.js";
import {
  verifySchool,
  getPendingRequests,
  reviewRequest,
} from "../controllers/approvalCenter.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

// Public: Verify school existence by Code or permanent ID
router.get("/schools/verify/:identifier", verifySchool);

router.use(authenticate, requireTenant);

// School Settings & Institutional Branding
router.get("/settings", authorize("principal", "superadmin"), getSchoolSettings);
router.put("/settings", authorize("principal", "superadmin"), updateSchoolSettings);

// Principal Approval Center for teacher & student self-registrations
router.get("/approval-center/requests", authorize("principal", "superadmin"), getPendingRequests);
router.put("/approval-center/requests/:id/review", authorize("principal", "superadmin"), reviewRequest);

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
