import express from "express";
import {
  getStudyMaterials,
  createStudyMaterial,
  updateStudyMaterial,
  deleteStudyMaterial,
} from "../controllers/studyMaterial.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

router.get("/", getStudyMaterials);
router.post("/", authorize("teacher", "principal", "superadmin"), createStudyMaterial);
router.put("/:id", authorize("teacher", "principal", "superadmin"), updateStudyMaterial);
router.delete("/:id", authorize("teacher", "principal", "superadmin"), deleteStudyMaterial);

export default router;
