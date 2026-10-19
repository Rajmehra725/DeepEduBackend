import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
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
    date: {
      type: String, // YYYY-MM-DD standard date string for normalized daily grouping
      required: true,
      index: true,
    },
    session: {
      type: String,
      enum: ["FullDay", "Morning", "Afternoon"],
      default: "FullDay",
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Leave"],
      required: true,
    },
    markedBy: {
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

// Compound unique index prevents duplicate attendance records for the same student, date, and session
attendanceSchema.index(
  { schoolId: 1, studentId: 1, date: 1, session: 1 },
  { unique: true }
);

attendanceSchema.index({ schoolId: 1, classId: 1, sectionId: 1, date: 1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
