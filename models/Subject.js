import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true, // e.g. "Mathematics", "Science", "English"
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["Core", "Elective", "Practical", "Extracurricular"],
      default: "Core",
    },
  },
  {
    timestamps: true,
  }
);

subjectSchema.index({ schoolId: 1, name: 1 }, { unique: true });

const Subject = mongoose.model("Subject", subjectSchema);
export default Subject;
