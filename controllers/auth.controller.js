import User from "../models/User.js";
import School from "../models/School.js";
import Subscription from "../models/Subscription.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
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
        // Find linked child
        studentProfile = await Student.findOne({
          $or: [{ parentUserId: user._id }, { parentPhone: user.phone }],
        })
          .populate("classId", "name numericGrade")
          .populate("sectionId", "name");
      }
    }

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
