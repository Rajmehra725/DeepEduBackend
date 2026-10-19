import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    term: {
      type: String,
      default: "Term 1",
    },
    academicSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Draft", "Scheduled", "Under Review", "Published", "Locked"],
      default: "Scheduled",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

examSchema.index({ schoolId: 1, academicSessionId: 1 });

const Exam = mongoose.model("Exam", examSchema);
export default Exam;
