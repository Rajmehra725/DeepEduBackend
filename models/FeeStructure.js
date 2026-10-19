import mongoose from "mongoose";

const feeStructureSchema = new mongoose.Schema(
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
    academicSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      default: null,
    },
    category: {
      type: String,
      required: true, // e.g. "Tuition Fee", "Term Fee", "Exam Fee"
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    frequency: {
      type: String,
      enum: ["Monthly", "Quarterly", "Annual", "One-Time"],
      default: "Quarterly",
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

feeStructureSchema.index(
  { schoolId: 1, classId: 1, category: 1 },
  { unique: true }
);

const FeeStructure = mongoose.model("FeeStructure", feeStructureSchema);
export default FeeStructure;
