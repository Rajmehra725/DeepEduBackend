import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    admissionNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    rollNumber: {
      type: String,
      trim: true,
      default: "",
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
      default: "",
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Male",
    },
    dateOfBirth: {
      type: Date,
      default: null,
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
    academicSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      default: null,
    },
    parentName: {
      type: String,
      required: true,
      trim: true,
    },
    parentPhone: {
      type: String,
      required: true,
      trim: true,
    },
    parentEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    parentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    profileImage: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "transferred", "archived"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

studentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });
studentSchema.index({ schoolId: 1, classId: 1, sectionId: 1 });
studentSchema.index({ schoolId: 1, status: 1 });

const Student = mongoose.model("Student", studentSchema);
export default Student;
