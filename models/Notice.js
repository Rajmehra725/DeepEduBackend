import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    targetAudience: {
      type: String,
      enum: ["All", "Teachers", "Students", "Parents"],
      default: "All",
    },
    priority: {
      type: String,
      enum: ["Normal", "High", "Urgent"],
      default: "Normal",
    },
    publishedDate: {
      type: Date,
      default: Date.now,
    },
    attachmentUrl: {
      type: String,
      default: "",
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

noticeSchema.index({ schoolId: 1, publishedDate: -1 });

const Notice = mongoose.model("Notice", noticeSchema);
export default Notice;
