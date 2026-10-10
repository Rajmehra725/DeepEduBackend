import express from "express";
import {
  register,
  login,
  refreshToken,
  getProfile,
  changePassword,
  recoverAccount,
  deleteAccount,
  logout,
  sendOTP,
  verifyOTP,
  checkUsernameAvailability,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/check-username", checkUsernameAvailability);
router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/recover-password", recoverAccount);

// Legacy compatibility
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);

// Protected routes
router.get("/me", protect, getProfile);
router.post("/change-password", protect, changePassword);
router.post("/logout", protect, logout);
router.delete("/delete-account", protect, deleteAccount);

export default router;