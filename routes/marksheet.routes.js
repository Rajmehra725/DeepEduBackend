import express from "express";
import {
  getStudentMarksheetData,
  getPrintableMarksheetHTML,
} from "../controllers/marksheet.controller.js";
import { authenticate } from "../middleware/auth.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// JSON marksheet payload
router.get("/:studentId", getStudentMarksheetData);

// Direct A4 printable HTML report card (openable in browser tab)
router.get("/:studentId/print", getPrintableMarksheetHTML);

export default router;
