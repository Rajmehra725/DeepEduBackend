import mongoose from "mongoose";

const academicSessionSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true, // e.g. "2026-2027"
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

academicSessionSchema.index({ schoolId: 1, name: 1 }, { unique: true });

const AcademicSession = mongoose.model("AcademicSession", academicSessionSchema);
export default AcademicSession;
