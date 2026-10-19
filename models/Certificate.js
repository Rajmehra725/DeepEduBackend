import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
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
    certificateNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: [
        "Bonafide Certificate",
        "Transfer Certificate",
        "Character Certificate",
        "Sports Achievement",
        "Academic Merit",
      ],
      required: true,
      index: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Draft", "Issued", "Revoked"],
      default: "Issued",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

certificateSchema.index(
  { schoolId: 1, certificateNumber: 1 },
  { unique: true }
);

const Certificate = mongoose.model("Certificate", certificateSchema);
export default Certificate;
