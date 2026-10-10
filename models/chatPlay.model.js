import mongoose from "mongoose";

const pollOptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false }
);

const chatPlaySchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    activityType: {
      type: String,
      enum: [
        "poll",
        "this_or_that",
        "guess_emoji",
        "word_chain",
        "quiz",
        "starter",
      ],
      default: "poll",
    },
    title: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      default: "",
    },
    options: [pollOptionSchema],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const ChatPlay =
  mongoose.models.ChatPlay || mongoose.model("ChatPlay", chatPlaySchema);

export default ChatPlay;
