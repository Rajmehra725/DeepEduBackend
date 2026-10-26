import mongoose from "mongoose";

const registrationRequestSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["Teacher", "Student"],
      required: true,
      index: true,
    },
    // Common applicant details
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    password: {
      type: String,
      default: "",
    },
    photoUrl: {
      type: String,
      default: "",
    },
    // Teacher-specific fields
    qualifications: {
      type: String,
      default: "",
    },
    experience: {
      type: String,
      default: "",
    },
    designation: {
      type: String,
      default: "Teacher",
    },
    subjectSpecialization: {
      type: String,
      default: "",
    },
    // Student-specific fields
    parentName: {
      type: String,
      default: "",
    },
    parentPhone: {
      type: String,
      default: "",
    },
    parentEmail: {
      type: String,
      default: "",
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassRoom",
      default: null,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      default: null,
    },
    address: {
      type: String,
      default: "",
    },
    // Approval Lifecycle
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Changes Requested"],
      default: "Pending",
      index: true,
    },
    reviewReason: {
      type: String,
      default: "",
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
  },
  {
    timestamps: true,
  }
);

registrationRequestSchema.index({ schoolId: 1, type: 1, status: 1 });

const RegistrationRequest = mongoose.model("RegistrationRequest", registrationRequestSchema);
export default RegistrationRequest;
