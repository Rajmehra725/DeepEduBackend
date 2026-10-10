import mongoose from "mongoose";

const timeCapsuleSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "Time Capsule",
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    mediaUrl: {
      type: String,
      default: "",
    },
    deliverAt: {
      type: Date,
      required: true,
      index: true,
    },
    isSelfCapsule: {
      type: Boolean,
      default: false,
    },
    occasion: {
      type: String,
      enum: ["general", "birthday", "anniversary", "future_self", "reminder"],
      default: "general",
    },
    status: {
      type: String,
      enum: ["pending", "delivered", "cancelled", "failed"],
      default: "pending",
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    deliveryAttempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

timeCapsuleSchema.index({ status: 1, deliverAt: 1 });

const TimeCapsule =
  mongoose.models.TimeCapsule ||
  mongoose.model("TimeCapsule", timeCapsuleSchema);

export default TimeCapsule;
