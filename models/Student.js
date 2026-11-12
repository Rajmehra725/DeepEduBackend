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
    permanentId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
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
    bloodGroup: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    religion: {
      type: String,
      trim: true,
      default: "",
    },
    nationality: {
      type: String,
      trim: true,
      default: "Indian",
    },
    aadharNumber: {
      type: String,
      trim: true,
      default: "",
    },
    guardianName: {
      type: String,
      trim: true,
      default: "",
    },
    guardianPhone: {
      type: String,
      trim: true,
      default: "",
    },
    guardianEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    guardianRelation: {
      type: String,
      trim: true,
      default: "",
    },
    emergencyContact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      relation: { type: String, default: "" },
    },
    admissionDate: {
      type: Date,
      default: Date.now,
    },
    previousSchool: {
      type: String,
      trim: true,
      default: "",
    },
    documents: [
      {
        name: { type: String, required: true },
        type: { type: String, default: "document" },
        url: { type: String, required: true },
        publicId: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    promotionHistory: [
      {
        sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession" },
        sessionName: { type: String, default: "" },
        classId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassRoom" },
        className: { type: String, default: "" },
        sectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Section" },
        sectionName: { type: String, default: "" },
        rollNumber: { type: String, default: "" },
        promotedAt: { type: Date, default: Date.now },
        status: { type: String, default: "Promoted" },
        remarks: { type: String, default: "" },
      },
    ],
    teacherRemarks: [
      {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
        teacherName: { type: String, default: "" },
        subjectName: { type: String, default: "" },
        remark: { type: String, required: true },
        category: {
          type: String,
          enum: ["Academic", "Behavior", "Attendance", "Achievement", "General"],
          default: "Academic",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
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
studentSchema.index({ schoolId: 1, permanentId: 1 }, { unique: true, sparse: true });
studentSchema.index({ schoolId: 1, classId: 1, sectionId: 1 });
studentSchema.index({ schoolId: 1, status: 1 });

const Student = mongoose.model("Student", studentSchema);
export default Student;
