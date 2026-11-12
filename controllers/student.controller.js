import Student from "../models/Student.js";
import User from "../models/User.js";
import School from "../models/School.js";
import Subscription from "../models/Subscription.js";
import ClassRoom from "../models/ClassRoom.js";
import Section from "../models/Section.js";
import Attendance from "../models/Attendance.js";
import FeePayment from "../models/FeePayment.js";
import FeeStructure from "../models/FeeStructure.js";
import ExamMark from "../models/ExamMark.js";
import Homework from "../models/Homework.js";
import AcademicSession from "../models/AcademicSession.js";
import AuditLog from "../models/AuditLog.js";
import Teacher from "../models/Teacher.js";
import ClassSubjectTeacher from "../models/ClassSubjectTeacher.js";
import Notification from "../models/Notification.js";
import { generatePermanentId } from "../utils/idGenerator.js";

export const getStudents = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const {
      search = "",
      classId,
      sectionId,
      academicSessionId,
      status = "active",
      page = 1,
      limit = 10,
    } = req.query;

    const query = { schoolId };

    if (status && status !== "all") {
      query.status = status;
    }

    // Scope access for Teachers to their assigned sections
    if (req.user?.role === "teacher") {
      const teacher = await Teacher.findOne({ userId: req.user._id, schoolId });
      if (teacher) {
        const assignments = await ClassSubjectTeacher.find({ schoolId, teacherId: teacher._id });
        const classTeacherSections = await Section.find({ schoolId, classTeacherId: teacher._id });
        const allowedSectionIds = [
          ...assignments.map((a) => a.sectionId),
          ...classTeacherSections.map((s) => s._id),
        ].filter(Boolean);

        if (sectionId) {
          const isAllowed = allowedSectionIds.some((id) => id.toString() === sectionId.toString());
          if (!isAllowed) {
            return res.status(403).json({
              success: false,
              message: "Forbidden: You are not assigned to this class section",
            });
          }
          query.sectionId = sectionId;
        } else if (allowedSectionIds.length > 0) {
          query.sectionId = { $in: allowedSectionIds };
        }
      }
    } else if (sectionId) {
      query.sectionId = sectionId;
    }

    if (classId) {
      query.classId = classId;
    }

    if (academicSessionId) {
      query.academicSessionId = academicSessionId;
    }

    if (search) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { admissionNumber: searchRegex },
        { permanentId: searchRegex },
        { rollNumber: searchRegex },
        { aadharNumber: searchRegex },
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
      .populate("academicSessionId", "name")
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
          pages: Math.ceil(total / limitNum) || 1,
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
      .populate("academicSessionId", "name")
      .populate("userId", "email status profileImage");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found in your school",
      });
    }

    // Parallel fetch attendance history, fee records, examination marks, and homework
    const [attendanceRecords, feePayments, feeStructure, examMarks, homeworkRecords] = await Promise.all([
      Attendance.find({ studentId: id, schoolId }).sort({ date: -1 }).limit(30),
      FeePayment.find({ studentId: id, schoolId }).sort({ paymentDate: -1 }),
      FeeStructure.findOne({ schoolId, classId: student.classId?._id || student.classId }),
      ExamMark.find({ studentId: id, schoolId })
        .populate("examId", "name term startDate endDate")
        .populate("subjectId", "name code"),
      Homework.find({
        schoolId,
        classId: student.classId?._id || student.classId,
        sectionId: student.sectionId?._id || student.sectionId,
      })
        .populate("subjectId", "name")
        .sort({ dueDate: -1 })
        .limit(10),
    ]);

    // Attendance stats
    const totalDays = attendanceRecords.length;
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    attendanceRecords.forEach((r) => {
      if (r.status === "Present") presentCount++;
      else if (r.status === "Absent") absentCount++;
      else if (r.status === "Leave") leaveCount++;
    });
    const attendancePercentage = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 100;

    // Fee calculations
    const totalPaid = feePayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const totalExpected = feeStructure?.amount || 0;
    const totalDues = Math.max(0, totalExpected - totalPaid);

    const studentObj = student.toObject();
    const payload = {
      ...studentObj,
      student: studentObj,
      attendanceSummary: {
        totalDays,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        percentage: attendancePercentage,
        recentRecords: attendanceRecords,
      },
      feeSummary: {
        totalExpected,
        totalPaid,
        totalDues,
        payments: feePayments,
        feeStructure,
      },
      examinationResults: examMarks || [],
      homeworkRecords: homeworkRecords || [],
    };

    return res.status(200).json({
      success: true,
      data: payload,
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
      profileImage = "",
      bloodGroup = "",
      category = "General",
      religion = "",
      nationality = "Indian",
      aadharNumber = "",
      guardianName = "",
      guardianPhone = "",
      guardianEmail = "",
      guardianRelation = "",
      emergencyContact = {},
      previousSchool = "",
      documents = [],
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
        profileImage: profileImage || "",
        status: "active",
      });
    } else if (profileImage && !user.profileImage) {
      user.profileImage = profileImage;
      await user.save();
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
      profileImage: profileImage || "",
      bloodGroup: bloodGroup ? bloodGroup.trim() : "",
      category: category || "General",
      religion: religion ? religion.trim() : "",
      nationality: nationality || "Indian",
      aadharNumber: aadharNumber ? aadharNumber.trim() : "",
      guardianName: guardianName ? guardianName.trim() : "",
      guardianPhone: guardianPhone ? guardianPhone.trim() : "",
      guardianEmail: guardianEmail ? guardianEmail.trim().toLowerCase() : "",
      guardianRelation: guardianRelation ? guardianRelation.trim() : "",
      emergencyContact: emergencyContact || {},
      previousSchool: previousSchool ? previousSchool.trim() : "",
      documents: Array.isArray(documents) ? documents : [],
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
      .populate("sectionId", "name")
      .populate("academicSessionId", "name");

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

    // If profileImage updated, sync with User
    if (updateData.profileImage && student.userId) {
      await User.findByIdAndUpdate(student.userId, { profileImage: updateData.profileImage });
    }

    // Update student fields
    const updated = await Student.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    )
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("academicSessionId", "name");

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

/**
 * Add Document to Student Profile
 */
export const addStudentDocument = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const { name, type = "document", url, publicId = "" } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: "Document name and file URL are required",
      });
    }

    const student = await Student.findOne({ _id: id, schoolId });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    student.documents.push({
      name: name.trim(),
      type,
      url,
      publicId,
      uploadedAt: new Date(),
    });

    await student.save();

    return res.status(200).json({
      success: true,
      message: "Document attached successfully",
      data: student.documents,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add document",
      error: error.message,
    });
  }
};

/**
 * Delete Document from Student Profile
 */
export const deleteStudentDocument = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id, docId } = req.params;

    const student = await Student.findOne({ _id: id, schoolId });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    student.documents = student.documents.filter(
      (doc) => doc._id.toString() !== docId
    );

    await student.save();

    return res.status(200).json({
      success: true,
      message: "Document removed successfully",
      data: student.documents,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete document",
      error: error.message,
    });
  }
};

/**
 * Update Student Photo
 */
export const updateStudentPhoto = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const { profileImage } = req.body;

    if (!profileImage) {
      return res.status(400).json({
        success: false,
        message: "Photo URL is required",
      });
    }

    const student = await Student.findOneAndUpdate(
      { _id: id, schoolId },
      { $set: { profileImage } },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (student.userId) {
      await User.findByIdAndUpdate(student.userId, { profileImage });
    }

    return res.status(200).json({
      success: true,
      message: "Student photo updated successfully",
      data: { profileImage: student.profileImage },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update student photo",
      error: error.message,
    });
  }
};

/**
 * Promote Student to Next Class/Section
 */
export const promoteStudent = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const { toClassId, toSectionId, sessionId, rollNumber, remarks = "" } = req.body;

    if (!toClassId || !toSectionId) {
      return res.status(400).json({
        success: false,
        message: "Target class and section are required for promotion",
      });
    }

    const student = await Student.findOne({ _id: id, schoolId })
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("academicSessionId", "name");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Record past session in promotion history
    student.promotionHistory.push({
      sessionId: student.academicSessionId?._id || student.academicSessionId,
      sessionName: student.academicSessionId?.name || "Previous Session",
      classId: student.classId?._id || student.classId,
      className: student.classId?.name || "Previous Class",
      sectionId: student.sectionId?._id || student.sectionId,
      sectionName: student.sectionId?.name || "Previous Section",
      rollNumber: student.rollNumber || "",
      promotedAt: new Date(),
      status: "Promoted",
      remarks,
    });

    student.classId = toClassId;
    student.sectionId = toSectionId;
    if (sessionId) student.academicSessionId = sessionId;
    if (rollNumber) student.rollNumber = rollNumber;

    await student.save();

    const updated = await Student.findById(id)
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("academicSessionId", "name");

    return res.status(200).json({
      success: true,
      message: "Student promoted successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to promote student",
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

/**
 * Add Teacher Academic Remark to Student Profile
 */
export const addTeacherRemark = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const { remark, category = "Academic", subjectName = "" } = req.body;

    if (!remark?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Remark text is required",
      });
    }

    const student = await Student.findOne({ _id: id, schoolId });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found in your school",
      });
    }

    let teacher = null;
    let teacherName = req.user.name || "Faculty";
    if (req.user.role === "teacher") {
      teacher = await Teacher.findOne({ userId: req.user._id, schoolId });
      if (teacher) {
        teacherName = `${teacher.firstName} ${teacher.lastName || ""}`.trim();
      }
    }

    if (!student.teacherRemarks) {
      student.teacherRemarks = [];
    }

    student.teacherRemarks.unshift({
      teacherId: teacher?._id,
      teacherName,
      subjectName: subjectName.trim(),
      remark: remark.trim(),
      category,
      createdAt: new Date(),
    });

    await student.save();

    // Notify student user if linked
    if (student.userId) {
      await Notification.create({
        schoolId,
        recipientId: student.userId,
        title: `Academic Remark from ${teacherName}`,
        message: `Remark (${category}): ${remark.trim()}`,
        type: "Academics",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Teacher remark recorded successfully",
      data: student.teacherRemarks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to record teacher remark",
      error: error.message,
    });
  }
};
