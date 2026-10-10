import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relationship: { type: String, default: "", trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const medicalInfoSchema = new mongoose.Schema(
  {
    bloodGroup: {
      type: String,
      enum: ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      default: "",
    },
    allergies: { type: [String], default: [] },
    medicalConditions: { type: [String], default: [] },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const privacySettingsSchema = new mongoose.Schema(
  {
    ghostMode: { type: Boolean, default: false },
    showOnline: { type: Boolean, default: true },
    showLastSeen: { type: Boolean, default: true },
    showReadReceipts: { type: Boolean, default: true },
    showTyping: { type: Boolean, default: true },
    showPhone: { type: Boolean, default: false },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: "22:00" },
      end: { type: String, default: "07:00" },
    },
  },
  { _id: false }
);

const moodSchema = new mongoose.Schema(
  {
    mood: {
      type: String,
      enum: [
        "",
        "happy",
        "loved",
        "chill",
        "sad",
        "excited",
        "grateful",
        "thoughtful",
        "tired",
        "focused",
        "need_company",
        "need_space",
      ],
      default: "",
    },
    note: { type: String, default: "" },
    updatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    isPrivate: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: false,
      sparse: true,
      trim: true,
      index: true,
    },
    mobileNumber: {
      type: String,
      sparse: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
    },
    displayName: {
      type: String,
      default: "",
      trim: true,
    },
    interests: {
      type: [String],
      default: [],
    },
    isProfilePrivate: {
      type: Boolean,
      default: false,
    },
    realYouMode: {
      type: String,
      enum: ["public", "friends", "just_me"],
      default: "public",
    },
    password: {
      type: String,
      select: false,
    },
    profileImage: {
      type: String,
      default: "",
    },
    coverImage: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "Hey there! I am using SmileyX.",
      maxlength: 250,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Other",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "India" },
    pincode: { type: String, default: "" },
    profileCompleted: { type: Boolean, default: true },
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
    medicalInfo: { type: medicalInfoSchema, default: () => ({}) },
    currentLocation: { type: locationSchema, default: () => ({}) },
    deviceToken: { type: String, default: "" },
    deviceTokens: { type: [String], default: [] },
    role: {
      type: String,
      enum: ["user", "moderator", "admin", "super_admin"],
      default: "user",
    },
    isPrimarySuperAdmin: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },
    sosEnabled: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    socketId: { type: String, default: "" },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    privacySettings: {
      type: privacySettingsSchema,
      default: () => ({}),
    },
    currentMood: {
      type: moodSchema,
      default: () => ({}),
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function () {
  if (this.phone) {
    this.mobileNumber = this.phone;
  }
  if (!this.isModified("password") || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if model is already registered to avoid overwrite issues
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;