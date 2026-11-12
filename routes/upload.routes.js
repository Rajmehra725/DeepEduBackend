import express from "express";
import multer from "multer";
import { uploadFile } from "../controllers/upload.controller.js";
import { authenticate } from "../middleware/auth.js";
import { requireTenant } from "../middleware/tenant.js";

// Memory storage keeps file buffer available for secure streaming to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = express.Router();

router.use(authenticate, requireTenant);

// Unified upload route supporting multipart & base64
router.post("/", upload.single("file"), uploadFile);

export default router;
