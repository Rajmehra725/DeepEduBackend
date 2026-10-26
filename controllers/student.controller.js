import Student from "../models/Student.js";
import User from "../models/User.js";
import School from "../models/School.js";
import Subscription from "../models/Subscription.js";
import ClassRoom from "../models/ClassRoom.js";
import Section from "../models/Section.js";
import AuditLog from "../models/AuditLog.js";
import { generatePermanentId } from "../utils/idGenerator.js";

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
        { permanentId: searchRegex },
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

    // Generate concurrency-safe permanent Student ID (e.g. STU-2026-0001)
    const permanentId = await generatePermanentId(schoolId, "student", "STU");

    const newStudent = await Student.create({
      schoolId,
      userId: user._id,
      permanentId,
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

    if (parentUser) {
      if (!parentUser.linkedStudents) parentUser.linkedStudents = [];
      if (!parentUser.linkedStudents.includes(newStudent._id)) {
        parentUser.linkedStudents.push(newStudent._id);
        await parentUser.save();
      }
    }

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

/**
 * Bulk CSV Student Import
 */
export const importStudentsCSV = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { rows, csvText } = req.body;

    let studentRows = rows;
    if (!studentRows && csvText) {
      const lines = csvText.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim());
      studentRows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const rowObj = {};
        headers.forEach((h, i) => {
          rowObj[h] = values[i] || "";
        });
        return rowObj;
      });
    }

    if (!Array.isArray(studentRows) || studentRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No student records provided. Please provide an array of rows or CSV text.",
      });
    }

    // Check School Subscription Limit
    const subscription = await Subscription.findOne({ schoolId });
    const limit = subscription?.studentLimit || 750;
    const currentActiveStudents = await Student.countDocuments({ schoolId, status: "active" });

    if (currentActiveStudents + studentRows.length > limit) {
      return res.status(403).json({
        success: false,
        message: `Importing ${studentRows.length} students would exceed the school plan limit of ${limit} (current: ${currentActiveStudents}). Please upgrade subscription.`,
      });
    }

    const school = await School.findById(schoolId);
    const classes = await ClassRoom.find({ schoolId });
    const sections = await Section.find({ schoolId });

    let importedCount = 0;
    let failedCount = 0;
    const report = [];

    for (let i = 0; i < studentRows.length; i++) {
      const row = studentRows[i];
      const admissionNumber =
        row.admissionNumber?.trim()?.toUpperCase() ||
        `ADM-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${i + 1}`;
      const firstName = row.firstName?.trim();
      const lastName = row.lastName?.trim() || "";
      const parentName = row.parentName?.trim() || `${firstName}'s Parent`;
      const parentPhone = row.parentPhone?.trim() || "0000000000";
      const parentEmail = row.parentEmail?.trim()?.toLowerCase() || "";
      const rollNumber = row.rollNumber?.trim() || String(i + 1);

      if (!firstName) {
        failedCount++;
        report.push({ row: i + 1, status: "Failed", reason: "Missing firstName" });
        continue;
      }

      // Duplicate check
      const existing = await Student.findOne({ schoolId, admissionNumber });
      if (existing) {
        failedCount++;
        report.push({ row: i + 1, status: "Failed", admissionNumber, reason: "Duplicate admissionNumber" });
        continue;
      }

      // Match class & section
      let classId = row.classId;
      if (!classId && row.className) {
        const matchCls = classes.find((c) => c.name.toLowerCase() === row.className.toLowerCase());
        if (matchCls) classId = matchCls._id;
      }
      if (!classId && classes.length > 0) classId = classes[0]._id;

      let sectionId = row.sectionId;
      if (!sectionId && row.sectionName) {
        const matchSec = sections.find((s) => s.name.toLowerCase() === row.sectionName.toLowerCase());
        if (matchSec) sectionId = matchSec._id;
      }
      if (!sectionId && sections.length > 0) sectionId = sections[0]._id;

      if (!classId || !sectionId) {
        failedCount++;
        report.push({ row: i + 1, status: "Failed", reason: "No valid class or section found" });
        continue;
      }

      const permanentId = await generatePermanentId(schoolId, "student", "STU");
      const studentEmail = `${admissionNumber.toLowerCase()}@${school?.code?.toLowerCase() || "deepedu"}.edu`;

      let user = await User.findOne({ email: studentEmail });
      if (!user) {
        user = await User.create({
          name: `${firstName} ${lastName}`.trim(),
          email: studentEmail,
          password: "Student@123",
          role: "student",
          schoolId,
          phone: parentPhone,
          status: "active",
        });
      }

      const newStudent = await Student.create({
        schoolId,
        userId: user._id,
        permanentId,
        admissionNumber,
        rollNumber,
        firstName,
        lastName,
        classId,
        sectionId,
        parentName,
        parentPhone,
        parentEmail,
        status: "active",
      });

      importedCount++;
      report.push({ row: i + 1, status: "Success", permanentId, admissionNumber, name: `${firstName} ${lastName}` });
    }

    await AuditLog.create({
      schoolId,
      userId: req.user?._id,
      action: "CSV_STUDENT_IMPORT",
      entity: "Student",
      details: { importedCount, failedCount, totalRows: studentRows.length },
      ipAddress: req.ip || "",
    });

    return res.status(201).json({
      success: true,
      message: `CSV import completed: ${importedCount} imported, ${failedCount} failed`,
      data: {
        imported: importedCount,
        importedCount,
        failed: failedCount,
        permanentIds: report.filter((r) => r.status === "Success").map((r) => r.permanentId),
        report,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "CSV import failed",
      error: error.message,
    });
  }
};

/**
 * Verified Parent-Child Linking
 */
export const linkParentStudent = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { parentUserId, studentId } = req.body;

    if (!parentUserId || !studentId) {
      return res.status(400).json({ success: false, message: "parentUserId and studentId are required" });
    }

    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found in your school" });
    }

    const parentUser = await User.findOne({ _id: parentUserId, schoolId, role: "parent" });
    if (!parentUser) {
      return res.status(404).json({ success: false, message: "Parent account not found in your school" });
    }

    student.parentUserId = parentUser._id;
    await student.save();

    if (!parentUser.linkedStudents) parentUser.linkedStudents = [];
    if (!parentUser.linkedStudents.includes(student._id)) {
      parentUser.linkedStudents.push(student._id);
      await parentUser.save();
    }

    await AuditLog.create({
      schoolId,
      userId: req.user?._id,
      action: "PARENT_CHILD_LINKED",
      entity: "Student",
      entityId: student._id.toString(),
      details: { parentEmail: parentUser.email, studentName: `${student.firstName} ${student.lastName}` },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: `Student ${student.firstName} successfully linked to Parent ${parentUser.name}`,
      data: {
        studentId: student._id,
        parentUserId: parentUser._id,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Linking failed", error: error.message });
  }
};
