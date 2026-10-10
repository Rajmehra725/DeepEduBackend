import express from "express";
import {
  recordMood,
  getMoodHistory,
  updateMoodEntry,
  deleteMoodEntry,
} from "../controllers/mood.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/record", recordMood);
router.get("/history", getMoodHistory);
router.put("/:entryId", updateMoodEntry);
router.delete("/:entryId", deleteMoodEntry);

export default router;
