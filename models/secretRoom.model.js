import mongoose from "mongoose";

const secretRoomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Secret Room",
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    messageExpirySeconds: {
      type: Number,
      default: 300, // 5 minutes default
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    revokedInvite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const SecretRoom =
  mongoose.models.SecretRoom ||
  mongoose.model("SecretRoom", secretRoomSchema);

export default SecretRoom;
