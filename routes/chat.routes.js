import express from "express";
import {
  getOrCreateDirectChat,
  getConversations,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  togglePinMessage,
  toggleStarMessage,
} from "../controllers/chat.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/conversations", protect, getConversations);
router.post("/direct", protect, getOrCreateDirectChat);
router.get("/messages/:conversationId", protect, getMessages);
router.post("/messages/:conversationId", protect, sendMessage);
router.put("/messages/:messageId", protect, editMessage);
router.delete("/messages/:messageId", protect, deleteMessage);
router.post("/messages/:messageId/reaction", protect, reactToMessage);
router.put("/messages/:messageId/pin", protect, togglePinMessage);
router.put("/messages/:messageId/star", protect, toggleStarMessage);

export default router;
