import express from "express";
import {
  createSecretRoom,
  joinSecretRoom,
  closeSecretRoom,
} from "../controllers/secretRoom.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/create", protect, createSecretRoom);
router.post("/join", protect, joinSecretRoom);
router.post("/close/:roomId", protect, closeSecretRoom);

export default router;
