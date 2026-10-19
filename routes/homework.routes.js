import express from "express";
import {
  getHomework,
  createHomework,
  deleteHomework,
} from "../controllers/homework.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

router.get("/", getHomework);
router.post("/", authorize("teacher", "principal", "superadmin"), createHomework);
router.delete("/:id", authorize("teacher", "principal", "superadmin"), deleteHomework);

export default router;
