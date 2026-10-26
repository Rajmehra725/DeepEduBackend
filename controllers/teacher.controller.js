import Teacher from "../models/Teacher.js";
import User from "../models/User.js";
import ClassSubjectTeacher from "../models/ClassSubjectTeacher.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import AuditLog from "../models/AuditLog.js";
import { generatePermanentId } from "../utils/idGenerator.js";

export const getTeachers = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { search = "", status = "active", page = 1, limit = 10 } = req.query;

    const query = { schoolId };
    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { employeeId: searchRegex },
        { permanentId: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { designation: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await Teacher.countDocuments(query);
    const teachers = await Teacher.find(query)
      .sort({ employeeId: 1, firstName: 1 })
      .skip(skip)
      .limit(limitNum);

    // Fetch assigned class & subject count for each teacher
    const teachersWithAssignments = await Promise.all(
      teachers.map(async (t) => {
        const assignments = await ClassSubjectTeacher.find({
          schoolId,
          teacherId: t._id,
        })
          .populate("classId", "name")
          .populate("sectionId", "name")
          .populate("subjectId", "name");

        return {
          ...t.toObject(),
          assignments,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        teachers: teachersWithAssignments,
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
      message: "Failed to fetch teachers",
      error: error.message,
    });
  }
};

export const getTeacherById = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const teacher = await Teacher.findOne({ _id: id, schoolId });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found in your school",
      });
    }

    const assignments = await ClassSubjectTeacher.find({
      schoolId,
      teacherId: teacher._id,
    })
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("subjectId", "name code type");

    return res.status(200).json({
      success: true,
      data: {
        ...teacher.toObject(),
        assignments,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch teacher details",
      error: error.message,
    });
  }
};

export const createTeacher = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const {
      employeeId,
      firstName,
      lastName,
      email,
      phone,
      designation,
      qualification,
      specialization,
      joiningDate,
      password = "Teacher@123",
    } = req.body;

    if (!employeeId || !firstName || !email) {
      return res.status(400).json({
        success: false,
        message: "employeeId, firstName, and email are required",
      });
    }

    // Check duplicate employeeId in school
    const existingEmp = await Teacher.findOne({
      schoolId,
      employeeId: employeeId.trim().toUpperCase(),
    });

    if (existingEmp) {
      return res.status(400).json({
        success: false,
        message: `Teacher with employee ID '${employeeId}' already exists in your school`,
      });
    }

    // Check or create user login
    let user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      return res.status(400).json({
        success: false,
        message: `User with email '${email}' already exists`,
      });
    }

    user = await User.create({
      name: `${firstName} ${lastName || ""}`.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: "teacher",
      schoolId,
      phone,
      status: "active",
    });

    const permanentId = await generatePermanentId(schoolId, "teacher", "TCH");

    const teacher = await Teacher.create({
      schoolId,
      userId: user._id,
      permanentId,
      employeeId: employeeId.trim().toUpperCase(),
      firstName: firstName.trim(),
      lastName: lastName ? lastName.trim() : "",
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : "",
      designation: designation || "Senior Teacher",
      qualification: qualification || "B.Ed",
      specialization: specialization || "",
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Teacher added successfully",
      data: {
        teacher,
        credentials: {
          email,
          defaultPassword: password,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create teacher",
      error: error.message,
    });
  }
};

export const updateTeacher = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const updateData = req.body;

    const teacher = await Teacher.findOneAndUpdate(
      { _id: id, schoolId },
      { $set: updateData },
      { new: true }
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found in your school",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
      data: teacher,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update teacher",
      error: error.message,
    });
  }
};

export const deleteTeacher = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const teacher = await Teacher.findOneAndUpdate(
      { _id: id, schoolId },
      { status: "archived" },
      { new: true }
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Teacher record archived safely",
      data: teacher,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to archive teacher",
      error: error.message,
    });
  }
};

export const getMyAssignedClasses = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;

    // Find teacher record corresponding to logged-in user
    const teacher = await Teacher.findOne({ userId, schoolId });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "No teacher profile linked to this user account",
      });
    }

    const assignments = await ClassSubjectTeacher.find({
      schoolId,
      teacherId: teacher._id,
    })
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name capacity")
      .populate("subjectId", "name code type");

    // Also check if teacher is a designated Class Teacher for any section
    const classTeacherSections = await Section.find({
      schoolId,
      classTeacherId: teacher._id,
    }).populate("classId", "name numericGrade");

    // Group assigned classes with student counts
    const classMap = {};
    for (const item of assignments) {
      if (!item.classId || !item.sectionId) continue;
      const key = `${item.classId._id}-${item.sectionId._id}`;
      if (!classMap[key]) {
        const studentCount = await Student.countDocuments({
          schoolId,
          classId: item.classId._id,
          sectionId: item.sectionId._id,
          status: "active",
        });

        classMap[key] = {
          classId: item.classId._id,
          className: item.classId.name,
          sectionId: item.sectionId._id,
          sectionName: item.sectionId.name,
          studentCount,
          subjects: [],
        };
      }
      if (item.subjectId) {
        classMap[key].subjects.push({
          id: item.subjectId._id,
          name: item.subjectId.name,
          code: item.subjectId.code,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        teacher,
        assignedClasses: Object.values(classMap),
        classTeacherSections,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned classes",
      error: error.message,
    });
  }
};

/**
 * Bulk CSV Teacher Import
 */
export const importTeachersCSV = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { rows, csvText } = req.body;

    let teacherRows = rows;
    if (!teacherRows && csvText) {
      const lines = csvText.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim());
      teacherRows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const rowObj = {};
        headers.forEach((h, i) => {
          rowObj[h] = values[i] || "";
        });
        return rowObj;
      });
    }

    if (!Array.isArray(teacherRows) || teacherRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No teacher records provided. Please provide an array of rows or CSV text.",
      });
    }

    let importedCount = 0;
    let failedCount = 0;
    const report = [];

    for (let i = 0; i < teacherRows.length; i++) {
      const row = teacherRows[i];
      const employeeId = row.employeeId?.trim()?.toUpperCase();
      const firstName = row.firstName?.trim();
      const lastName = row.lastName?.trim() || "Faculty";
      const email = row.email?.trim()?.toLowerCase();
      const phone = row.phone?.trim() || "";
      const designation = row.designation?.trim() || "Teacher";
      const qualification = row.qualification?.trim() || "Post Graduate";

      if (!employeeId || !firstName || !email) {
        failedCount++;
        report.push({ row: i + 1, status: "Failed", reason: "Missing employeeId, firstName, or email" });
        continue;
      }

      // Check duplicates
      const existingTeacher = await Teacher.findOne({ schoolId, employeeId });
      if (existingTeacher) {
        failedCount++;
        report.push({ row: i + 1, status: "Failed", employeeId, reason: "Duplicate employeeId in this school" });
        continue;
      }

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: `${firstName} ${lastName}`.trim(),
          email,
          password: "Teacher@123",
          role: "teacher",
          schoolId,
          phone,
          status: "active",
        });
      }

      const permanentId = await generatePermanentId(schoolId, "teacher", "TCH");

      const newTeacher = await Teacher.create({
        schoolId,
        userId: user._id,
        employeeId,
        permanentId,
        firstName,
        lastName,
        email,
        phone,
        designation,
        qualification,
        status: "Active",
      });

      importedCount++;
      report.push({ row: i + 1, status: "Success", permanentId, employeeId, name: `${firstName} ${lastName}` });
    }

    await AuditLog.create({
      schoolId,
      userId: req.user?._id,
      action: "CSV_TEACHER_IMPORT",
      entity: "Teacher",
      details: { importedCount, failedCount, totalRows: teacherRows.length },
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
