import express from "express";
import {
  listCertificates,
  issueCertificate,
  getCertificateById,
  getPrintableCertificateHTML,
  revokeCertificate,
} from "../controllers/certificate.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Certificates list & get
router.get("/", listCertificates);
router.get("/:id", getCertificateById);
router.get("/:id/print", getPrintableCertificateHTML);

// Issuance & Revocation (Principal & Superadmin only)
router.post("/", authorize("principal", "superadmin"), issueCertificate);
router.patch("/:id/revoke", authorize("principal", "superadmin"), revokeCertificate);

export default router;
