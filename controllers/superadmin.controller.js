import School from "../models/School.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";

export const getDashboardStats = async (req, res) => {
  try {
    const totalSchools = await School.countDocuments();
    const activeSchools = await School.countDocuments({ status: "active" });
    const trialSchools = await School.countDocuments({ status: "trial" });
    const suspendedSchools = await School.countDocuments({ status: "suspended" });

    const totalStudents = await Student.countDocuments({ status: "active" });
    const totalTeachers = await Teacher.countDocuments({ status: "active" });

    const recentSchools = await School.find()
      .sort({ createdAt: -1 })
      .limit(5);

    // Calculate schools with subscriptions expiring within 14 days
    const in14Days = new Date();
    in14Days.setDate(in14Days.getDate() + 14);
    const expiringSoon = await Subscription.find({
      endDate: { $lte: in14Days, $gte: new Date() },
    }).populate("schoolId", "name code email");

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalSchools,
          activeSchools,
          trialSchools,
          suspendedSchools,
          totalStudents,
          totalTeachers,
        },
        recentSchools,
        expiringSoon,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Super Admin dashboard statistics",
      error: error.message,
    });
  }
};

export const getSchools = async (req, res) => {
  try {
    const { search = "", status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await School.countDocuments(query);
    const schools = await School.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const schoolIds = schools.map((s) => s._id);
    const subscriptions = await Subscription.find({
      schoolId: { $in: schoolIds },
    });

    const subMap = {};
    subscriptions.forEach((sub) => {
      subMap[sub.schoolId.toString()] = sub;
    });

    // Also get student counts per school
    const schoolsWithDetails = await Promise.all(
      schools.map(async (s) => {
        const studentCount = await Student.countDocuments({
          schoolId: s._id,
          status: "active",
        });
        const teacherCount = await Teacher.countDocuments({
          schoolId: s._id,
          status: "active",
        });
        return {
          ...s.toObject(),
          subscription: subMap[s._id.toString()] || null,
          studentCount,
          teacherCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        schools: schoolsWithDetails,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch schools",
      error: error.message,
    });
  }
};

export const createSchool = async (req, res) => {
  try {
    const {
      name,
      code,
      email,
      phone,
      address,
      principalName,
      principalEmail,
      principalPassword,
      plan = "growth",
      studentLimit = 500,
      durationDays = 365,
    } = req.body;

    if (!name || !code || !email || !principalEmail || !principalPassword) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (name, code, email, principalEmail, principalPassword)",
      });
    }

    const existingCode = await School.findOne({ code: code.toUpperCase().trim() });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `School with code ${code} already exists`,
      });
    }

    const existingUser = await User.findOne({ email: principalEmail.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: `User with email ${principalEmail} already exists`,
      });
    }

    // 1. Create School
    const school = await School.create({
      name,
      code: code.toUpperCase().trim(),
      email: email.toLowerCase().trim(),
      phone,
      address,
      status: "active",
      studentLimit,
    });

    // 2. Create Principal User
    const principalUser = await User.create({
      name: principalName || `${name} Principal`,
      email: principalEmail.toLowerCase().trim(),
      password: principalPassword,
      role: "principal",
      schoolId: school._id,
      phone,
      status: "active",
    });

    // 3. Create Subscription
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (parseInt(durationDays, 10) || 365));

    const subscription = await Subscription.create({
      schoolId: school._id,
      plan,
      status: "active",
      studentLimit,
      startDate: new Date(),
      endDate,
    });

    return res.status(201).json({
      success: true,
      message: "School and Principal account created successfully",
      data: {
        school,
        principalUser: {
          id: principalUser._id,
          name: principalUser.name,
          email: principalUser.email,
          role: principalUser.role,
        },
        subscription,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create school",
      error: error.message,
    });
  }
};

export const updateSchoolStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "trial", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const school = await School.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `School status updated to ${status}`,
      data: school,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update school status",
      error: error.message,
    });
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params; // School ID
    const { plan, studentLimit, endDate, status } = req.body;

    const updateData = {};
    if (plan) updateData.plan = plan;
    if (studentLimit) updateData.studentLimit = Number(studentLimit);
    if (endDate) updateData.endDate = new Date(endDate);
    if (status) updateData.status = status;

    const subscription = await Subscription.findOneAndUpdate(
      { schoolId: id },
      { $set: updateData },
      { new: true, upsert: true }
    );

    if (studentLimit) {
      await School.findByIdAndUpdate(id, { studentLimit: Number(studentLimit) });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update subscription",
      error: error.message,
    });
  }
};
