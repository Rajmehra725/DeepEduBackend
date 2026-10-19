import express from "express";
import { login, getMe, changePassword } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticate, getMe);
router.post("/change-password", authenticate, changePassword);

export default router;
