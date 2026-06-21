import mongoose from "mongoose";

const cardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    fatherName: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    dob: {
      type: String,
      required: true,
    },

    district: {
      type: String,
      required: true,
    },

    state: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
    },

    aadhaar: {
      type: String,
      required: true,
    },

    profileImage: {
      type: String,
      required: true,
    },

    aadhaarImage: {
      type: String,
      required: true,
    },
    cardNumber: {
  type: String,
  required: true,
  unique: true,
},

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Approved",
    },
  },
  {
    timestamps: true,
  }
);

const Card = mongoose.model("Card", cardSchema);

export default Card;