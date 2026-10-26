import express from "express";
import { login, getMe, changePassword, forgotPassword, resetPassword } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { verifyCaptcha } from "../middleware/captcha.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticate, getMe);
router.post("/change-password", authenticate, changePassword);
router.post("/forgot-password", verifyCaptcha, forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
