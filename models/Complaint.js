import mongoose from "mongoose";

const complaintHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    studentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: ["Teaching", "Classroom", "Behaviour", "Academic issue", "Other"],
      default: "Academic issue",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    attachmentUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: [
        "Submitted",
        "Under Review",
        "Assigned",
        "In Progress",
        "Resolved",
        "Rejected",
      ],
      default: "Submitted",
      index: true,
    },
    adminNotes: {
      type: String,
      default: "",
    },
    resolutionReason: {
      type: String,
      default: "",
    },
    history: [complaintHistorySchema],
  },
  {
    timestamps: true,
  }
);

complaintSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });
complaintSchema.index({ schoolId: 1, teacherId: 1, status: 1 });

const Complaint = mongoose.model("Complaint", complaintSchema);
export default Complaint;
