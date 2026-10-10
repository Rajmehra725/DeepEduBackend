import express from "express";
import {
  createPost,
  getPostsFeed,
  reactToPost,
  votePoll,
  addComment,
  getComments,
  toggleSavePost,
  editPost,
  deletePost,
} from "../controllers/post.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/create", createPost);
router.get("/feed", getPostsFeed);
router.post("/:postId/react", reactToPost);
router.post("/:postId/poll/:optionId/vote", votePoll);
router.post("/:postId/comments", addComment);
router.get("/:postId/comments", getComments);
router.post("/:postId/save", toggleSavePost);
router.put("/:postId", editPost);
router.delete("/:postId", deletePost);

export default router;
