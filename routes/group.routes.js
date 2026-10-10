import express from "express";
import {
  createGroup,
  getGroupDetails,
  addMembers,
  removeMember,
  leaveGroup,
  joinByInviteCode,
  toggleAdminOnlyMessaging,
} from "../controllers/group.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/create", protect, createGroup);
router.get("/:groupId", protect, getGroupDetails);
router.post("/:groupId/members", protect, addMembers);
router.delete("/:groupId/members/:memberId", protect, removeMember);
router.post("/:groupId/leave", protect, leaveGroup);
router.post("/join/:code", protect, joinByInviteCode);
router.put("/:groupId/admin-messaging", protect, toggleAdminOnlyMessaging);

export default router;
