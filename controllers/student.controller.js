import Student from "../models/Student.js";
import User from "../models/User.js";
import School from "../models/School.js";
import Subscription from "../models/Subscription.js";

export const getStudents = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const {
      search = "",
      classId,
      sectionId,
      status = "active",
      page = 1,
      limit = 10,
    } = req.query;

    const query = { schoolId };

    if (status && status !== "all") {
      query.status = status;
    }

    if (classId) {
      query.classId = classId;
    }

    if (sectionId) {
      query.sectionId = sectionId;
    }

    if (search) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { admissionNumber: searchRegex },
        { parentName: searchRegex },
        { parentPhone: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .sort({ admissionNumber: 1, firstName: 1 })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      data: {
        students,
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
      message: "Failed to fetch students",
      error: error.message,
    });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const student = await Student.findOne({ _id: id, schoolId })
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("userId", "email status");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found in your school",
      });
    }

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student details",
      error: error.message,
    });
  }
};

export const createStudent = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const {
      admissionNumber,
      rollNumber,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      classId,
      sectionId,
      academicSessionId,
      parentName,
      parentPhone,
      parentEmail,
      address,
      studentPassword = "Student@123",
    } = req.body;

    if (!admissionNumber || !firstName || !classId || !sectionId || !parentName || !parentPhone) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (admissionNumber, firstName, classId, sectionId, parentName, parentPhone)",
      });
    }

    // Check School Student Limit from Subscription
    const school = await School.findById(schoolId);
    const subscription = await Subscription.findOne({ schoolId });
    const limit = subscription?.studentLimit || school?.studentLimit || 500;
    const currentActiveStudents = await Student.countDocuments({
      schoolId,
      status: "active",
    });

    if (currentActiveStudents >= limit) {
      return res.status(403).json({
        success: false,
        message: `Student limit of ${limit} reached for your school. Please upgrade your subscription plan to admit more students.`,
      });
    }

    // Check duplicate admissionNumber within this school
    const existingAdmission = await Student.findOne({
      schoolId,
      admissionNumber: admissionNumber.trim().toUpperCase(),
    });

    if (existingAdmission) {
      return res.status(400).json({
        success: false,
        message: `Student with admission number '${admissionNumber}' already exists in your school`,
      });
    }

    // Create student user account
    const studentEmail = `${admissionNumber.trim().toLowerCase()}@${school?.code?.toLowerCase() || "deepedu"}.edu`;
    let user = await User.findOne({ email: studentEmail });
    if (!user) {
      user = await User.create({
        name: `${firstName} ${lastName || ""}`.trim(),
        email: studentEmail,
        password: studentPassword,
        role: "student",
        schoolId,
        phone: parentPhone,
        status: "active",
      });
    }

    // Optionally link or create parent user account
    let parentUser = null;
    if (parentEmail) {
      parentUser = await User.findOne({ email: parentEmail.toLowerCase().trim() });
      if (!parentUser) {
        parentUser = await User.create({
          name: parentName,
          email: parentEmail.toLowerCase().trim(),
          password: "Parent@123",
          role: "parent",
          schoolId,
          phone: parentPhone,
          status: "active",
        });
      }
    }

    const newStudent = await Student.create({
      schoolId,
      userId: user._id,
      admissionNumber: admissionNumber.trim().toUpperCase(),
      rollNumber: rollNumber ? rollNumber.trim() : "",
      firstName: firstName.trim(),
      lastName: lastName ? lastName.trim() : "",
      gender: gender || "Male",
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      classId,
      sectionId,
      academicSessionId: academicSessionId || null,
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      parentEmail: parentEmail ? parentEmail.trim().toLowerCase() : "",
      parentUserId: parentUser ? parentUser._id : null,
      address: address ? address.trim() : "",
      status: "active",
    });

    const populatedStudent = await Student.findById(newStudent._id)
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name");

    return res.status(201).json({
      success: true,
      message: "Student admitted successfully",
      data: {
        student: populatedStudent,
        credentials: {
          username: studentEmail,
          defaultPassword: studentPassword,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to admit student",
      error: error.message,
    });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const updateData = req.body;

    // Prevent cross-school update
    const student = await Student.findOne({ _id: id, schoolId });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found in your school",
      });
    }

    // Update student fields
    const updated = await Student.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    )
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name");

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update student",
      error: error.message,
    });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    // Soft archive student to preserve academic & financial records
    const student = await Student.findOneAndUpdate(
      { _id: id, schoolId },
      { status: "archived" },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student record archived safely",
      data: student,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to archive student",
      error: error.message,
    });
  }
};
