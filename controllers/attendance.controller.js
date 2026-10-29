import Attendance from "../models/Attendance.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import ClassSubjectTeacher from "../models/ClassSubjectTeacher.js";
import Section from "../models/Section.js";
import Notification from "../models/Notification.js";

export const getRoster = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, sectionId, date = new Date().toISOString().split("T")[0], session = "FullDay" } = req.query;

    if (!classId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: "classId and sectionId are required",
      });
    }

    const students = await Student.find({
      schoolId,
      classId,
      sectionId,
      status: "active",
    }).sort({ rollNumber: 1, firstName: 1 });

    const attendanceRecords = await Attendance.find({
      schoolId,
      classId,
      sectionId,
      date,
      session,
    });

    const statusMap = {};
    attendanceRecords.forEach((record) => {
      statusMap[record.studentId.toString()] = {
        status: record.status,
        remarks: record.remarks,
        id: record._id,
      };
    });

    const roster = students.map((s) => ({
      studentId: s._id,
      admissionNumber: s.admissionNumber,
      rollNumber: s.rollNumber,
      name: `${s.firstName} ${s.lastName || ""}`.trim(),
      profileImage: s.profileImage,
      parentName: s.parentName,
      parentPhone: s.parentPhone,
      status: statusMap[s._id.toString()]?.status || "Present", // default to Present for convenience
      remarks: statusMap[s._id.toString()]?.remarks || "",
      isMarked: Boolean(statusMap[s._id.toString()]),
    }));

    const totalStudents = roster.length;
    const presentCount = roster.filter((r) => r.status === "Present").length;
    const absentCount = roster.filter((r) => r.status === "Absent").length;
    const leaveCount = roster.filter((r) => r.status === "Leave").length;

    return res.status(200).json({
      success: true,
      data: {
        date,
        session,
        classId,
        sectionId,
        roster,
        summary: {
          total: totalStudents,
          present: presentCount,
          absent: absentCount,
          leave: leaveCount,
          isAlreadySubmitted: attendanceRecords.length > 0,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance roster",
      error: error.message,
    });
  }
};

export const markAttendance = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const {
      classId,
      sectionId,
      date = new Date().toISOString().split("T")[0],
      session = "FullDay",
      records = [],
    } = req.body;

    if (!classId || !sectionId || !records.length) {
      return res.status(400).json({
        success: false,
        message: "classId, sectionId, and attendance records are required",
      });
    }

    // Role-based permission check: If teacher, verify they teach this class or are class teacher
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ userId, schoolId });
      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "No teacher profile found for your account",
        });
      }

      const isClassTeacher = await Section.findOne({
        _id: sectionId,
        schoolId,
        classTeacherId: teacher._id,
      });

      const isSubjectTeacher = await ClassSubjectTeacher.findOne({
        schoolId,
        classId,
        sectionId,
        teacherId: teacher._id,
      });

      if (!isClassTeacher && !isSubjectTeacher) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are not assigned to mark attendance for this class and section",
        });
      }
    }

    const savedRecords = [];
    const absentStudentsToNotify = [];

    for (const record of records) {
      const { studentId, remarks = "" } = record;
      const rawStatus = (record.status || "").trim();
      const titleStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
      const status = titleStatus === "Late" ? "Leave" : titleStatus;

      if (!["Present", "Absent", "Leave"].includes(status)) continue;

      const attendance = await Attendance.findOneAndUpdate(
        { schoolId, studentId, date, session },
        {
          schoolId,
          studentId,
          classId,
          sectionId,
          date,
          session,
          status,
          remarks,
          markedBy: userId,
        },
        { upsert: true, new: true }
      );

      savedRecords.push(attendance);

      if (status === "Absent") {
        absentStudentsToNotify.push(studentId);
      }
    }

    // Trigger parent/student in-app notifications for absences
    if (absentStudentsToNotify.length > 0) {
      const absentStudents = await Student.find({
        _id: { $in: absentStudentsToNotify },
      });

      for (const st of absentStudents) {
        const recipients = [st.userId];
        if (st.parentUserId) recipients.push(st.parentUserId);

        for (const rId of recipients) {
          await Notification.create({
            schoolId,
            recipientId: rId,
            title: "Attendance Notice: Absent Today",
            message: `${st.firstName} was marked Absent on ${date} for ${session} session.`,
            type: "Attendance",
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Attendance marked successfully for ${savedRecords.length} students`,
      data: {
        date,
        session,
        count: savedRecords.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark attendance",
      error: error.message,
    });
  }
};

export const getStudentAttendance = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId } = req.params;

    // Student & Parent role permission check: verify they only access their authorized studentId
    if (req.user.role === "student") {
      const ownStudent = await Student.findOne({ userId: req.user._id, schoolId });
      if (!ownStudent || ownStudent._id.toString() !== studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You may only view your own attendance record",
        });
      }
    } else if (req.user.role === "parent") {
      const authorizedChild = await Student.findOne({
        _id: studentId,
        schoolId,
        $or: [{ parentUserId: req.user._id }, { parentPhone: req.user.phone }],
      });
      if (!authorizedChild) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to view this student's records",
        });
      }
    }

    const records = await Attendance.find({ schoolId, studentId }).sort({ date: -1 });

    const totalDays = records.length;
    const presentDays = records.filter((r) => r.status === "Present").length;
    const absentDays = records.filter((r) => r.status === "Absent").length;
    const leaveDays = records.filter((r) => r.status === "Leave").length;
    const percentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : "100.0";

    return res.status(200).json({
      success: true,
      data: {
        studentId,
        totalDays,
        presentDays,
        absentDays,
        leaveDays,
        percentage: Number(percentage),
        records,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student attendance",
      error: error.message,
    });
  }
};
