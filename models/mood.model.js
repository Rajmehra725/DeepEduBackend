import mongoose from "mongoose";

const moodEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mood: {
      type: String,
      enum: [
        "happy",
        "loved",
        "chill",
        "sad",
        "excited",
        "grateful",
        "thoughtful",
        "tired",
      ],
      required: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    isPrivate: {
      type: Boolean,
      default: true, // Sensitive personal data is strictly private by default
    },
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

moodEntrySchema.index({ user: 1, date: -1 });

const MoodEntry =
  mongoose.models.MoodEntry || mongoose.model("MoodEntry", moodEntrySchema);

export default MoodEntry;
