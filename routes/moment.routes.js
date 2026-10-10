import express from "express";
import {
  createMoment,
  getMomentsFeed,
  viewMoment,
  reactToMoment,
  deleteMoment,
} from "../controllers/moment.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/create", protect, createMoment);
router.get("/feed", protect, getMomentsFeed);
router.post("/view/:momentId", protect, viewMoment);
router.post("/react/:momentId", protect, reactToMoment);
router.delete("/:momentId", protect, deleteMoment);

export default router;
