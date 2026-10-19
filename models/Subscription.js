import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["starter", "growth", "enterprise", "custom"],
      default: "growth",
    },
    status: {
      type: String,
      enum: ["active", "trial", "past_due", "cancelled", "expired"],
      default: "trial",
      index: true,
    },
    studentLimit: {
      type: Number,
      default: 500,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    gracePeriodDays: {
      type: Number,
      default: 7,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "annually"],
      default: "annually",
    },
    price: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;
