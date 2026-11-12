import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
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
    employeeId: {
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
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    profileImage: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", ""],
      default: "",
    },
    dob: {
      type: Date,
      default: null,
    },
    designation: {
      type: String,
      trim: true,
      default: "Senior Teacher",
    },
    qualification: {
      type: String,
      trim: true,
      default: "B.Ed, M.Sc",
    },
    specialization: {
      type: String,
      trim: true,
      default: "",
    },
    experience: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },
    emergencyContact: {
      name: { type: String, default: "" },
      relation: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },
    documents: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, default: "Certificate" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

teacherSchema.index({ schoolId: 1, employeeId: 1 }, { unique: true });
teacherSchema.index({ schoolId: 1, permanentId: 1 }, { unique: true, sparse: true });

const Teacher = mongoose.model("Teacher", teacherSchema);
export default Teacher;
