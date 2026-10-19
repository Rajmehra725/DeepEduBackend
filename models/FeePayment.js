import mongoose from "mongoose";

const feePaymentSchema = new mongoose.Schema(
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
    receiptNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Cheque", "Bank Transfer", "UPI", "Demand Draft"],
      default: "Cash",
    },
    transactionRef: {
      type: String,
      trim: true,
      default: "",
    },
    feeCategory: {
      type: String,
      default: "General School Fee",
    },
    recordedBy: {
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

feePaymentSchema.index({ schoolId: 1, receiptNumber: 1 }, { unique: true });
feePaymentSchema.index({ schoolId: 1, studentId: 1, paymentDate: -1 });

const FeePayment = mongoose.model("FeePayment", feePaymentSchema);
export default FeePayment;
