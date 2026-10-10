import express from "express";
import {
  searchUsers,
  getUserProfile,
  updateProfile,
  updatePrivacySettings,
  updateMood,
  blockUser,
  unblockUser,
  registerDeviceToken,
} from "../controllers/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/search", protect, searchUsers);
router.get("/profile/:id", protect, getUserProfile);
router.put("/profile", protect, updateProfile);
router.put("/privacy", protect, updatePrivacySettings);
router.put("/mood", protect, updateMood);
router.post("/block", protect, blockUser);
router.post("/unblock", protect, unblockUser);
router.post("/device-token", protect, registerDeviceToken);

export default router;
