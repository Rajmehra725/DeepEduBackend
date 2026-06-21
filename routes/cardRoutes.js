import express from "express";
import upload from "../middleware/upload.js";

import {
  createCard,
  getCards,
  getCard,
  updateStatus,
  deleteCard,
} from "../controllers/cardController.js";

const router = express.Router();

router.post(
  "/create",
  upload.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
    {
      name: "aadhaarImage",
      maxCount: 1,
    },
  ]),
  createCard
);

router.get("/", getCards);

router.get("/:id", getCard);

router.put("/:id/status", updateStatus);

router.delete("/:id", deleteCard);

export default router;