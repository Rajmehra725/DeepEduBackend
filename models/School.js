import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country: { type: String, default: "India" },
    },
    logo: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "trial", "inactive", "suspended"],
      default: "trial",
      index: true,
    },
    studentLimit: {
      type: Number,
      default: 500,
    },
    currentSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const School = mongoose.model("School", schoolSchema);
export default School;
