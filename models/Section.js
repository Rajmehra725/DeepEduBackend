import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassRoom",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true, // e.g. "A", "B", "Rose"
      trim: true,
    },
    capacity: {
      type: Number,
      default: 45,
    },
    classTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

sectionSchema.index({ schoolId: 1, classId: 1, name: 1 }, { unique: true });

const Section = mongoose.model("Section", sectionSchema);
export default Section;
