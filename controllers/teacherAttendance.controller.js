import TeacherAttendance from "../models/TeacherAttendance.js";
import Teacher from "../models/Teacher.js";

export const recordCheckIn = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const { status = "Present", remarks = "" } = req.body;

    const teacher = await Teacher.findOne({ userId, schoolId });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found for this user",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const attendance = await TeacherAttendance.findOneAndUpdate(
      { schoolId, teacherId: teacher._id, date: today },
      {
        $setOnInsert: {
          schoolId,
          teacherId: teacher._id,
          date: today,
          checkInTime: new Date(),
        },
        $set: {
          status,
          remarks,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `Teacher check-in recorded as '${status}' for today`,
      data: attendance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to record teacher check-in",
      error: error.message,
    });
  }
};

export const getMyAttendanceHistory = async (req, res) => {
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

    const history = await TeacherAttendance.find({
      schoolId,
      teacherId: teacher._id,
    }).sort({ date: -1 });

    const totalDays = history.length;
    const presentCount = history.filter((h) => h.status === "Present").length;
    const lateCount = history.filter((h) => h.status === "Late").length;
    const leaveCount = history.filter((h) => h.status === "On Leave").length;

    return res.status(200).json({
      success: true,
      data: {
        history,
        summary: {
          totalDays,
          presentCount,
          lateCount,
          leaveCount,
          percentage: totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(1) : "100.0",
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance history",
      error: error.message,
    });
  }
};

export const getSchoolTeacherAttendance = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { date = new Date().toISOString().split("T")[0] } = req.query;

    const teachers = await Teacher.find({ schoolId, status: "active" }).sort({
      employeeId: 1,
    });

    const attendanceRecords = await TeacherAttendance.find({
      schoolId,
      date,
    });

    const attMap = {};
    attendanceRecords.forEach((r) => {
      attMap[r.teacherId.toString()] = r;
    });

    const report = teachers.map((t) => ({
      teacherId: t._id,
      permanentId: t.permanentId || "",
      employeeId: t.employeeId,
      name: `${t.firstName} ${t.lastName || ""}`.trim(),
      designation: t.designation,
      status: attMap[t._id.toString()]?.status || "Not Checked In",
      checkInTime: attMap[t._id.toString()]?.checkInTime || null,
      remarks: attMap[t._id.toString()]?.remarks || "",
      reviewNote: attMap[t._id.toString()]?.reviewNote || "",
    }));

    const total = report.length;
    const present = report.filter((r) => r.status === "Present").length;
    const late = report.filter((r) => r.status === "Late").length;
    const onLeave = report.filter((r) => r.status === "On Leave").length;
    const pending = report.filter((r) => r.status === "Not Checked In").length;

    return res.status(200).json({
      success: true,
      data: {
        date,
        report,
        summary: {
          total,
          present,
          late,
          onLeave,
          pending,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch faculty attendance",
      error: error.message,
    });
  }
};

export const reviewTeacherAttendance = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const { teacherId, date, status, reviewNote = "" } = req.body;

    if (!teacherId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "teacherId, date, and status are required",
      });
    }

    const updated = await TeacherAttendance.findOneAndUpdate(
      { schoolId, teacherId, date },
      {
        schoolId,
        teacherId,
        date,
        status,
        reviewedBy: userId,
        reviewNote,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Teacher attendance reviewed and updated successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to review teacher attendance",
      error: error.message,
    });
  }
};
