import express from "express";
import {
  applyLeave,
  getMyLeaves,
  cancelLeave,
  getSchoolLeaves,
  reviewLeave,
} from "../controllers/leave.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Self-service leave actions (Teacher, Student)
router.post("/apply", authorize("teacher", "student", "principal"), applyLeave);
router.get("/my", authorize("teacher", "student", "principal"), getMyLeaves);
router.delete("/:id", authorize("teacher", "student", "principal"), cancelLeave);

// Administrative review actions (Principal, SuperAdmin)
router.get("/", authorize("principal", "superadmin"), getSchoolLeaves);
router.put("/:id/review", authorize("principal", "superadmin"), reviewLeave);

export default router;
