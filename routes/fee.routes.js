import express from "express";
import {
  getStructures,
  createStructure,
  getStudentFeeDetails,
  recordPayment,
  getReceipt,
} from "../controllers/fee.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Structures (Principal)
router.get("/structures", authorize("principal", "superadmin"), getStructures);
router.post("/structures", authorize("principal", "superadmin"), createStructure);

// Student fees (Principal, Parent, Student)
router.get("/student/:studentId", getStudentFeeDetails);

// Payments & Receipts
router.post("/payments", authorize("principal", "superadmin"), recordPayment);
router.get("/receipts/:receiptNumber", getReceipt);

export default router;
