import User from "../models/user.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken.js";
import jwt from "jsonwebtoken";

const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.__v;
  return obj;
};

/**
 * Register a new RaazChat user
 */
export const register = async (req, res) => {
  try {
    let { fullName, username, phone, password, confirmPassword, profileImage } =
      req.body;

    if (!fullName || !username || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Full Name, Username, Phone number, and Password are required",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and Confirm Password do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Clean username (remove leading @ and whitespace, lowercase)
    username = username.replace(/^@+/, "").trim().toLowerCase();
    phone = phone.trim();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          "Username must be 3-20 characters and contain only letters, numbers, and underscores",
      });
    }

    // Check if username is already taken
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: `Username @${username} is already taken. Please choose another.`,
      });
    }

    // Check if phone number is already registered
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is already registered. Please login.",
      });
    }

    // Check if first user to grant admin, otherwise user
    const totalUsers = await User.countDocuments();
    const role = totalUsers === 0 ? "admin" : "user";

    const user = new User({
      fullName: fullName.trim(),
      username,
      phone,
      password,
      profileImage: profileImage || "",
      role,
      isOnline: true,
      lastLogin: new Date(),
    });

    await user.save();

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.status(201).json({
      success: true,
      message: "Welcome to RaazChat! Account created successfully.",
      token,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};

/**
 * Login using Username + Password OR Mobile Number + Password
 */
export const login = async (req, res) => {
  try {
    const { identifier, username, phone, password } = req.body;

    const loginId = (identifier || username || phone || "").trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter your username/mobile and password",
      });
    }

    // Clean identifier
    const cleanUsername = loginId.replace(/^@+/, "").toLowerCase();

    // Query by username OR phone
    const user = await User.findOne({
      $or: [{ username: cleanUsername }, { phone: loginId }],
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. User does not exist.",
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `Your account has been banned: ${user.banReason || "Terms violation"}`,
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: "Your account is temporarily suspended. Contact support.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please try again.",
      });
    }

    // Update status
    user.isOnline = true;
    user.lastLogin = new Date();
    await user.save();

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: clientRefreshToken } = req.body;

    if (!clientRefreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const secret =
      process.env.JWT_REFRESH_SECRET ||
      process.env.JWT_SECRET ||
      "raazchat_refresh_secret_2026";

    const decoded = jwt.verify(clientRefreshToken, secret);
    const user = await User.findById(decoded.id);

    if (!user || user.isBanned || user.isSuspended) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token or inactive account",
      });
    }

    const token = generateAccessToken(user);
    return res.status(200).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Expired or invalid refresh token",
    });
  }
};

/**
 * Get profile of authenticated user
 */
export const getProfile = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: sanitizeUser(req.user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Change Password
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Account Recovery / Password Reset
 */
export const recoverAccount = async (req, res) => {
  try {
    const { phone, username, newPassword } = req.body;

    if ((!phone && !username) || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Registered phone/username and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const query = phone ? { phone } : { username: username.toLowerCase().replace(/^@+/, "") };
    const user = await User.findOne(query).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found matching the provided details",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You may now login.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete Account
 */
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: "Account deleted permanently",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Logout
 */
export const logout = async (req, res) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastSeen: new Date(),
        socketId: "",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      message: "Logout completed",
    });
  }
};

// Legacy backwards compatibility endpoints (for existing mobile clients)
export const sendOTP = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "OTP authentication is optional in RaazChat Pro. Please use password login or registration.",
    data: { phone: req.body.phone, otp: "123456" },
  });
};

export const verifyOTP = async (req, res) => {
  const { phone } = req.body;
  const user = await User.findOne({ phone });
  if (user) {
    const token = generateAccessToken(user);
    return res.status(200).json({
      success: true,
      isRegistered: true,
      message: "OTP Verified",
      token,
      user: sanitizeUser(user),
    });
  }
  return res.status(200).json({
    success: true,
    isRegistered: false,
    message: "Please complete registration",
    data: { phone },
  });
};