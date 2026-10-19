import express from "express";
import {
  createComplaint,
  getMyComplaints,
  getAssignedComplaints,
  getAllComplaints,
  updateComplaintStatus,
} from "../controllers/complaint.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Student / Parent submission & viewing
router.post("/", authorize("student", "parent"), createComplaint);
router.get("/my", authorize("student", "parent"), getMyComplaints);

// Teacher assigned complaints
router.get("/assigned", authorize("teacher"), getAssignedComplaints);

// Principal view all & update status
router.get("/", authorize("principal", "superadmin"), getAllComplaints);
router.put("/:id/status", authorize("principal", "superadmin"), updateComplaintStatus);

export default router;
