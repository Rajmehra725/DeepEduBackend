import express from "express";
import {
  createActivity,
  voteActivity,
  getConversationActivities,
} from "../controllers/chatPlay.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/activity", protect, createActivity);
router.post("/activity/:activityId/vote", protect, voteActivity);
router.get("/activities/:conversationId", protect, getConversationActivities);

export default router;
