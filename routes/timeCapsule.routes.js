import express from "express";
import {
  createCapsule,
  getMyCapsules,
  cancelCapsule,
} from "../controllers/timeCapsule.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/create", protect, createCapsule);
router.get("/my", protect, getMyCapsules);
router.put("/cancel/:capsuleId", protect, cancelCapsule);

export default router;
