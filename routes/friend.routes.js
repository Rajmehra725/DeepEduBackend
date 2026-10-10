import express from "express";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  getFriendsAndRequests,
} from "../controllers/friend.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/all", protect, getFriendsAndRequests);
router.post("/request", protect, sendFriendRequest);
router.put("/accept/:requestId", protect, acceptFriendRequest);
router.put("/reject/:requestId", protect, rejectFriendRequest);
router.delete("/cancel/:requestId", protect, cancelFriendRequest);
router.delete("/remove/:friendId", protect, removeFriend);

export default router;
