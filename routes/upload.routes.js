import express from "express";
import multer from "multer";
import { uploadFile } from "../controllers/upload.controller.js";
import { authenticate } from "../middleware/auth.js";
import { requireTenant } from "../middleware/tenant.js";

const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

const router = express.Router();

router.use(authenticate, requireTenant);

// Unified upload route supporting multipart & base64
router.post("/", upload.single("file"), uploadFile);

export default router;
