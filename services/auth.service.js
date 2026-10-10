import User from "../models/user.model.js";
import OTP from "../models/otp.model.js";
import generateOTP from "../utils/generateOTP.js";

/**
 * Send OTP Service
 */
export const sendOTPService = async (phone) => {
  // Delete previous OTP
  await OTP.deleteMany({ phone });

  // Generate OTP
  const otp = generateOTP();

  // OTP expiry (5 min)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Save OTP
  await OTP.create({
    phone,
    otp,
    expiresAt,
  });

  return otp;
};

/**
 * Verify OTP Service
 */
export const verifyOTPService = async (phone, otp) => {
  const otpRecord = await OTP.findOne({ phone });

  if (!otpRecord) {
    throw new Error("OTP not found");
  }

  if (otpRecord.expiresAt < new Date()) {
    await OTP.deleteOne({ _id: otpRecord._id });
    throw new Error("OTP expired");
  }

  if (otpRecord.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  // OTP verified
  await OTP.deleteOne({ _id: otpRecord._id });

  // Check user
  const user = await User.findOne({ phone });

  return {
    isRegistered: !!user,
    user,
  };
};

/**
 * Register Service
 */
export const registerService = async ({
  fullName,
  phone,
  email,
}) => {

  // Already registered?
  const existingUser = await User.findOne({ phone });

  if (existingUser) {
    throw new Error("User already exists");
  }

  // Create User
  const user = await User.create({
    fullName,
    phone,
    email,
    role: "user",
    isVerified: true,
  });

  return user;
};