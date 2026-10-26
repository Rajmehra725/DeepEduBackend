import crypto from "crypto";
import User from "../models/User.js";
import School from "../models/School.js";
import Subscription from "../models/Subscription.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import AuditLog from "../models/AuditLog.js";
import { generateToken } from "../utils/jwt.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide both email/username and password",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact administrator.`,
      });
    }

    let school = null;
    let subscription = null;
    let studentProfile = null;
    let teacherProfile = null;
    let linkedChildren = [];

    if (user.schoolId) {
      school = await School.findById(user.schoolId);
      if (school) {
        subscription = await Subscription.findOne({ schoolId: school._id });
        if (school.status === "suspended") {
          return res.status(403).json({
            success: false,
            message: "School access has been suspended. Please contact platform support.",
          });
        }
      }
      if (user.role === "student") {
        studentProfile = await Student.findOne({ userId: user._id })
          .populate("classId", "name numericGrade")
          .populate("sectionId", "name");
      } else if (user.role === "teacher") {
        teacherProfile = await Teacher.findOne({ userId: user._id });
      } else if (user.role === "parent") {
        linkedChildren = await Student.find({
          $or: [{ parentUserId: user._id }, { parentPhone: user.phone }],
        })
          .populate("classId", "name numericGrade")
          .populate("sectionId", "name");
        studentProfile = linkedChildren[0] || null;
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({
      id: user._id,
      role: user.role,
      schoolId: user.schoolId,
    });

    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      profileImage: user.profileImage,
      schoolId: user.schoolId,
      linkedStudents: user.linkedStudents,
    };

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data: {
        token,
        user: safeUser,
        school,
        subscription,
        studentProfile,
        teacherProfile,
        linkedChildren: linkedChildren || [],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = req.user;
    let school = null;
    let subscription = null;
    let studentProfile = null;
    let teacherProfile = null;
    let linkedChildren = [];

    if (user.schoolId) {
      school = await School.findById(user.schoolId);
      subscription = await Subscription.findOne({ schoolId: user.schoolId });

      if (user.role === "student") {
        studentProfile = await Student.findOne({ userId: user._id })
          .populate("classId", "name numericGrade")
          .populate("sectionId", "name");
      } else if (user.role === "teacher") {
        teacherProfile = await Teacher.findOne({ userId: user._id });
      } else if (user.role === "parent") {
        linkedChildren = await Student.find({
          $or: [{ parentUserId: user._id }, { parentPhone: user.phone }],
        })
          .populate("classId", "name numericGrade")
          .populate("sectionId", "name");
        studentProfile = linkedChildren[0] || null;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
        school,
        subscription,
        studentProfile,
        teacherProfile,
        linkedChildren,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user profile",
      error: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Old password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password does not match",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Password change failed",
      error: error.message,
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter your registered email address",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Return safe message without leaking user existence
      return res.status(200).json({
        success: true,
        message: "If an account exists with this email, password reset instructions have been generated.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    await AuditLog.create({
      schoolId: user.schoolId,
      userId: user._id,
      action: "FORGOT_PASSWORD_REQUEST",
      entity: "User",
      entityId: user._id.toString(),
      details: { email: user.email },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: "Password reset link and instructions generated successfully.",
      data: {
        resetToken: process.env.NODE_ENV !== "production" ? resetToken : undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to initiate password reset",
      error: error.message,
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Password reset token is invalid or has expired.",
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    await AuditLog.create({
      schoolId: user.schoolId,
      userId: user._id,
      action: "PASSWORD_RESET_SUCCESS",
      entity: "User",
      entityId: user._id.toString(),
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: "Password has been successfully reset. You may now log in with your new password.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: error.message,
    });
  }
};
