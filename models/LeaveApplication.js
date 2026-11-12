import mongoose from "mongoose";

const leaveApplicationSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
    applicantRole: {
      type: String,
      enum: ["teacher", "student"],
      required: true,
    },
    applicantName: {
      type: String,
      required: true,
      trim: true,
    },
    leaveType: {
      type: String,
      enum: ["Sick Leave", "Casual Leave", "Emergency Leave", "Duty Leave", "Maternity/Paternity", "Other"],
      default: "Casual Leave",
    },
    startDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    endDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    daysCount: {
      type: Number,
      default: 1,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    documentUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewerRemarks: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

leaveApplicationSchema.index({ schoolId: 1, applicantId: 1, status: 1 });
leaveApplicationSchema.index({ schoolId: 1, status: 1, createdAt: -1 });

const LeaveApplication = mongoose.model("LeaveApplication", leaveApplicationSchema);
export default LeaveApplication;
