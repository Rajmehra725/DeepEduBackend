import mongoose from "mongoose";

const postMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileType: { type: String, enum: ["image", "video"], default: "image" },
    thumbnailUrl: { type: String, default: "" },
  },
  { _id: false }
);

const pollOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: true }
);

const postReactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, default: "❤️" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    media: [postMediaSchema],
    feeling: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    hashtags: [{ type: String, lowercase: true, trim: true }],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    poll: {
      question: { type: String, default: "" },
      options: [pollOptionSchema],
      expiresAt: { type: Date, default: null },
    },
    audience: {
      type: String,
      enum: ["everyone", "friends", "inner_circle", "private"],
      default: "everyone",
      index: true,
    },
    reactions: [postReactionSchema],
    commentsCount: {
      type: Number,
      default: 0,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    allowComments: {
      type: Boolean,
      default: true,
    },
    savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
  }
);

postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ audience: 1, createdAt: -1 });

const Post = mongoose.models.Post || mongoose.model("Post", postSchema);

export default Post;
