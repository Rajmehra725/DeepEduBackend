import Teacher from "../models/Teacher.js";
import User from "../models/User.js";
import School from "../models/School.js";
import ClassSubjectTeacher from "../models/ClassSubjectTeacher.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import TimetableSlot from "../models/TimetableSlot.js";
import TeacherAttendance from "../models/TeacherAttendance.js";
import Homework from "../models/Homework.js";
import Exam from "../models/Exam.js";
import Notice from "../models/Notice.js";
import Notification from "../models/Notification.js";
import Complaint from "../models/Complaint.js";
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

/**
 * Get Comprehensive Teacher Dashboard Statistics & Real-time Feeds
 */
export const getTeacherDashboardStats = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;

    // 1. Fetch teacher record
    const teacher = await Teacher.findOne({ userId, schoolId });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "No teacher profile linked to your user account",
      });
    }

    // 2. Fetch school record
    const school = await School.findById(schoolId).select("name code logo address phone email");

    // 3. Fetch assigned classes & subjects
    const assignments = await ClassSubjectTeacher.find({ schoolId, teacherId: teacher._id })
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name")
      .populate("subjectId", "name code type");

    const classTeacherSections = await Section.find({ schoolId, classTeacherId: teacher._id })
      .populate("classId", "name numericGrade");

    // Unique classes & sections
    const sectionIds = [
      ...assignments.map((a) => a.sectionId?._id || a.sectionId),
      ...classTeacherSections.map((s) => s._id),
    ].filter(Boolean);

    const uniqueSectionIds = [...new Set(sectionIds.map((id) => id.toString()))];

    const uniqueClassIds = [
      ...assignments.map((a) => a.classId?._id?.toString() || a.classId?.toString()),
      ...classTeacherSections.map((s) => s.classId?._id?.toString() || s.classId?.toString()),
    ].filter(Boolean);
    const uniqueClassCount = new Set(uniqueClassIds).size;

    // Total assigned students
    const assignedStudentsCount = await Student.countDocuments({
      schoolId,
      sectionId: { $in: uniqueSectionIds },
      status: "active",
    });

    // Today's Timetable slots
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayDay = days[new Date().getDay()];
    const todaySlots = await TimetableSlot.find({
      schoolId,
      teacherId: teacher._id,
      dayOfWeek: todayDay,
    })
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("subjectId", "name code")
      .sort({ periodNumber: 1 });

    // Today's teacher attendance / check-in status
    const todayStr = new Date().toISOString().split("T")[0];
    const todayAttendance = await TeacherAttendance.findOne({
      schoolId,
      teacherId: teacher._id,
      date: todayStr,
    });

    // Attendance history summary
    const attHistory = await TeacherAttendance.find({
      schoolId,
      teacherId: teacher._id,
    });
    const totalDaysLogged = attHistory.length;
    const presentDays = attHistory.filter((h) => h.status === "Present").length;

    // Active Homework & Pending Evaluations
    const homeworkList = await Homework.find({
      schoolId,
      teacherId: teacher._id,
      status: "Active",
    })
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("subjectId", "name code")
      .sort({ dueDate: -1 });

    let pendingHomeworkEvaluations = 0;
    homeworkList.forEach((hw) => {
      const unevaluated = (hw.submissions || []).filter((s) => s.status === "Submitted").length;
      pendingHomeworkEvaluations += unevaluated;
    });

    // Upcoming Exams (scheduled or ongoing)
    const upcomingExams = await Exam.find({
      schoolId,
      status: { $in: ["Scheduled", "Ongoing", "Completed"] },
    })
      .sort({ startDate: 1 })
      .limit(5);

    // Recent Notices
    const notices = await Notice.find({
      schoolId,
      status: "published",
      targetAudience: { $in: ["all", "teachers"] },
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(5);

    // Recent Notifications for this teacher
    const notifications = await Notification.find({
      schoolId,
      recipientId: userId,
    })
      .sort({ createdAt: -1 })
      .limit(6);

    const unreadNotificationsCount = await Notification.countDocuments({
      schoolId,
      recipientId: userId,
      isRead: false,
    });

    // Assigned complaints count
    const complaintsCount = await Complaint.countDocuments({
      schoolId,
      assignedTo: teacher._id,
      status: { $in: ["Pending", "InReview"] },
    });

    return res.status(200).json({
      success: true,
      data: {
        teacher,
        school,
        stats: {
          assignedClassesCount: uniqueClassCount,
          assignedSectionsCount: uniqueSectionIds.length,
          assignedStudentsCount,
          todayClassesCount: todaySlots.length,
          todayAttendanceStatus: todayAttendance ? todayAttendance.status : "Pending",
          todayCheckInTime: todayAttendance?.checkInTime || null,
          staffAttendancePercentage: totalDaysLogged > 0 ? Math.round((presentDays / totalDaysLogged) * 100) : 100,
          pendingHomeworkEvaluations,
          activeHomeworkCount: homeworkList.length,
          upcomingExamsCount: upcomingExams.length,
          complaintsCount,
          unreadNotificationsCount,
        },
        todaySlots,
        todayAttendance,
        homeworkList,
        upcomingExams,
        notices,
        notifications,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch teacher dashboard statistics",
      error: error.message,
    });
  }
};

/**
 * Get Full 11-Section Comprehensive Profile for Logged-In Teacher
 */
export const getMyTeacherProfile = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;

    let teacher = await Teacher.findOne({ userId, schoolId });
    if (!teacher) {
      if (req.user.role === "teacher") {
        const empId = `EMP-${Date.now().toString().slice(-4)}`;
        const permanentId = await generatePermanentId(schoolId, "teacher", "TCH");
        teacher = await Teacher.create({
          schoolId,
          userId,
          employeeId: empId,
          permanentId,
          firstName: req.user.name?.split(" ")[0] || "Faculty",
          lastName: req.user.name?.split(" ").slice(1).join(" ") || "",
          email: req.user.email,
          phone: req.user.phone || "",
          profileImage: req.user.profileImage || "",
          designation: "Educator",
          qualification: "Post Graduate / B.Ed",
          status: "active",
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "No teacher profile found for this account",
        });
      }
    }

    const school = await School.findById(schoolId).select(
      "name code logo address phone email branch affiliationNumber udiseCode"
    );

    // Academic responsibilities: assigned classes, sections, subjects
    const assignments = await ClassSubjectTeacher.find({ schoolId, teacherId: teacher._id })
      .populate("classId", "name numericGrade")
      .populate("sectionId", "name capacity")
      .populate("subjectId", "name code type");

    // Class teacher responsibility
    const classTeacherSections = await Section.find({ schoolId, classTeacherId: teacher._id })
      .populate("classId", "name numericGrade");

    // Weekly timetable
    const timetable = await TimetableSlot.find({ schoolId, teacherId: teacher._id })
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("subjectId", "name code")
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    // Attendance history and monthly summary
    const attRecords = await TeacherAttendance.find({ schoolId, teacherId: teacher._id })
      .sort({ date: -1 })
      .limit(60);

    const totalDays = attRecords.length;
    const presentDays = attRecords.filter((r) => r.status === "Present").length;
    const leaveDays = attRecords.filter((r) => r.status === "Leave" || r.status === "HalfDay").length;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

    // Academic activity: homework & exams
    const homework = await Homework.find({ schoolId, teacherId: teacher._id }).sort({ createdAt: -1 });
    let pendingHomeworkEvaluations = 0;
    homework.forEach((hw) => {
      const pending = (hw.submissions || []).filter((s) => s.status === "Submitted").length;
      pendingHomeworkEvaluations += pending;
    });

    const exams = await Exam.find({ schoolId, status: { $in: ["Scheduled", "Ongoing", "Completed"] } })
      .sort({ startDate: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      data: {
        teacher: {
          ...teacher.toObject(),
          profileImage: teacher.profileImage || req.user.profileImage || "",
        },
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone,
          profileImage: req.user.profileImage,
          role: req.user.role,
          status: req.user.status,
        },
        school,
        academicResponsibilities: {
          assignments,
          classTeacherSections,
        },
        timetable,
        attendance: {
          summary: {
            totalDays,
            presentDays,
            leaveDays,
            attendancePercentage,
          },
          recentRecords: attRecords.slice(0, 15),
        },
        academicActivity: {
          totalHomeworkCreated: homework.length,
          pendingHomeworkEvaluations,
          upcomingExamsCount: exams.length,
          exams,
        },
        documents: teacher.documents || [],
      },
    });
  } catch (error) {
    console.error("Get teacher profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch comprehensive teacher profile",
      error: error.message,
    });
  }
};

/**
 * Update Permitted Teacher Profile Information
 */
export const updateMyTeacherProfile = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;

    const teacher = await Teacher.findOne({ userId, schoolId });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found",
      });
    }

    const {
      phone,
      gender,
      dob,
      address,
      emergencyContact,
      qualification,
      specialization,
      experience,
    } = req.body;

    if (phone !== undefined) {
      teacher.phone = phone.trim();
      await User.findByIdAndUpdate(userId, { phone: phone.trim() });
    }
    if (gender !== undefined) teacher.gender = gender;
    if (dob !== undefined) teacher.dob = dob ? new Date(dob) : null;
    if (experience !== undefined) teacher.experience = experience.trim();
    if (qualification !== undefined) teacher.qualification = qualification.trim();
    if (specialization !== undefined) teacher.specialization = specialization.trim();
    if (address !== undefined) teacher.address = address;
    if (emergencyContact !== undefined) teacher.emergencyContact = emergencyContact;

    await teacher.save();

    return res.status(200).json({
      success: true,
      message: "Teacher profile updated successfully",
      data: teacher,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

/**
 * Update Teacher Profile Photo
 */
export const uploadMyTeacherPhoto = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const { profileImage } = req.body;

    if (!profileImage) {
      return res.status(400).json({
        success: false,
        message: "Profile image URL is required",
      });
    }

    const teacher = await Teacher.findOneAndUpdate(
      { userId, schoolId },
      { profileImage },
      { new: true }
    );

    await User.findByIdAndUpdate(userId, { profileImage });

    return res.status(200).json({
      success: true,
      message: "Profile photo updated successfully",
      data: { profileImage },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update profile photo",
      error: error.message,
    });
  }
};

/**
 * Upload Authorized Teacher Document
 */
export const uploadMyTeacherDocument = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const { title, url, type = "Certificate" } = req.body;

    if (!title || !url) {
      return res.status(400).json({
        success: false,
        message: "Document title and URL are required",
      });
    }

    const teacher = await Teacher.findOne({ userId, schoolId });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found",
      });
    }

    teacher.documents.push({
      title: title.trim(),
      url,
      type,
      uploadedAt: new Date(),
    });

    await teacher.save();

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: teacher.documents,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to upload document",
      error: error.message,
    });
  }
};

/**
 * Delete Authorized Teacher Document
 */
export const deleteMyTeacherDocument = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const { docId } = req.params;

    const teacher = await Teacher.findOne({ userId, schoolId });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found",
      });
    }

    teacher.documents = teacher.documents.filter((doc) => doc._id.toString() !== docId);
    await teacher.save();

    return res.status(200).json({
      success: true,
      message: "Document removed successfully",
      data: teacher.documents,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove document",
      error: error.message,
    });
  }
};
