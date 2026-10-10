import mongoose from "mongoose";

const viewerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const momentReactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const momentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "video"],
      default: "text",
    },
    text: {
      type: String,
      default: "",
    },
    mediaUrl: {
      type: String,
      default: "",
    },
    backgroundColor: {
      type: String,
      default: "#FF7A00",
    },
    audience: {
      type: String,
      enum: ["everyone", "friends", "selected", "private"],
      default: "friends",
    },
    allowedViewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    viewers: [viewerSchema],
    reactions: [momentReactionSchema],
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index: automatically removed after expiresAt
    },
  },
  {
    timestamps: true,
  }
);

momentSchema.index({ user: 1, expiresAt: 1 });

const Moment = mongoose.models.Moment || mongoose.model("Moment", momentSchema);

export default Moment;
