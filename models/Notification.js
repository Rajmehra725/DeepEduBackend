import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "Attendance",
        "Homework",
        "Exam",
        "Fee",
        "Complaint",
        "Notice",
        "System",
      ],
      default: "System",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    linkUrl: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
