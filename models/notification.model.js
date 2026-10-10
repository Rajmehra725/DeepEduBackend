import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "reaction",
        "comment",
        "friend_request",
        "friend_accepted",
        "follow",
        "mention",
        "message",
        "memory",
        "vibe",
        "capsule",
        "system",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "SmileyX Notification",
    },
    message: {
      type: String,
      required: true,
    },
    targetType: {
      type: String,
      enum: ["post", "vibe", "chat", "profile", "capsule", "general"],
      default: "general",
    },
    targetId: {
      type: String,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
