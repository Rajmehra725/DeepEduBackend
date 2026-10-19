import mongoose from "mongoose";

const examMarkSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassRoom",
      required: true,
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    maxMarks: {
      type: Number,
      required: true,
      default: 100,
    },
    obtainedMarks: {
      type: Number,
      default: 0,
    },
    grade: {
      type: String,
      default: "F",
    },
    isAbsent: {
      type: Boolean,
      default: false,
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: a student can only have one marks record per exam per subject
examMarkSchema.index(
  { schoolId: 1, examId: 1, subjectId: 1, studentId: 1 },
  { unique: true }
);

const ExamMark = mongoose.model("ExamMark", examMarkSchema);
export default ExamMark;
