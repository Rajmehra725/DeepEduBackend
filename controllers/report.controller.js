import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import FeePayment from "../models/FeePayment.js";
import Teacher from "../models/Teacher.js";
import ClassRoom from "../models/ClassRoom.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import FeeStructure from "../models/FeeStructure.js";
import RegistrationRequest from "../models/RegistrationRequest.js";
import Complaint from "../models/Complaint.js";
import TeacherAttendance from "../models/TeacherAttendance.js";
import Notice from "../models/Notice.js";
import Exam from "../models/Exam.js";
import AuditLog from "../models/AuditLog.js";

export const exportStudents = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, sectionId } = req.query;
    const query = { schoolId };
    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;

    const students = await Student.find(query)
      .populate("classId", "name")
      .populate("sectionId", "name")
      .sort({ admissionNumber: 1 });

    const csvRows = [
      "AdmissionNumber,RollNumber,FirstName,LastName,Gender,Class,Section,ParentName,ParentPhone,Status",
    ];

    for (const s of students) {
      csvRows.push(
        `"${s.admissionNumber}","${s.rollNumber || ""}","${s.firstName}","${s.lastName || ""}","${s.gender}","${s.classId?.name || ""}","${s.sectionId?.name || ""}","${s.parentName}","${s.parentPhone}","${s.status}"`
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="students-${Date.now()}.csv"`
    );
    return res.status(200).send(csvRows.join("\n"));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to export students",
      error: error.message,
    });
  }
};

export const exportAttendance = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, sectionId, date } = req.query;
    const query = { schoolId };
    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;
    if (date) query.date = date;

    const records = await Attendance.find(query)
      .populate("studentId", "admissionNumber firstName lastName")
      .populate("classId", "name")
      .populate("sectionId", "name")
      .sort({ date: -1 });

    const csvRows = [
      "Date,Session,AdmissionNumber,StudentName,Class,Section,Status,Remarks",
    ];

    for (const r of records) {
      csvRows.push(
        `"${r.date}","${r.session}","${r.studentId?.admissionNumber || ""}","${r.studentId?.firstName || ""} ${r.studentId?.lastName || ""}","${r.classId?.name || ""}","${r.sectionId?.name || ""}","${r.status}","${r.remarks || ""}"`
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${Date.now()}.csv"`
    );
    return res.status(200).send(csvRows.join("\n"));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to export attendance",
      error: error.message,
    });
  }
};

export const exportFees = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const payments = await FeePayment.find({ schoolId })
      .populate("studentId", "admissionNumber firstName lastName")
      .sort({ paymentDate: -1 });

    const csvRows = [
      "ReceiptNumber,Date,AdmissionNumber,StudentName,Amount,Method,Category,Remarks",
    ];

    for (const p of payments) {
      const dateStr = p.paymentDate
        ? new Date(p.paymentDate).toISOString().split("T")[0]
        : "";
      csvRows.push(
        `"${p.receiptNumber}","${dateStr}","${p.studentId?.admissionNumber || ""}","${p.studentId?.firstName || ""} ${p.studentId?.lastName || ""}","${p.amount}","${p.paymentMethod}","${p.feeCategory}","${p.remarks || ""}"`
      );
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="fee-collections-${Date.now()}.csv"`
    );
    return res.status(200).send(csvRows.join("\n"));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to export fees",
      error: error.message,
    });
  }
};

/**
 * Principal Command Center Aggregation Endpoint.
 * Computes live, authorized metrics across all school collections in a single round-trip.
 */
export const getPrincipalDashboardStats = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const today = new Date().toISOString().split("T")[0];
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSections,
      totalSubjects,
      feeStructures,
      feePayments,
      pendingApprovals,
      unresolvedComplaints,
      todayTeacherAtt,
      todayStudentAtt,
      recentNotices,
      upcomingExams,
      pendingLeaves,
      recentActivities,
    ] = await Promise.all([
      Student.countDocuments({ schoolId, status: "active" }),
      Teacher.countDocuments({ schoolId, status: "active" }),
      ClassRoom.countDocuments({ schoolId }),
      Section.countDocuments({ schoolId }),
      Subject.countDocuments({ schoolId }),
      FeeStructure.find({ schoolId }),
      FeePayment.aggregate([
        { $match: { schoolId } },
        { $group: { _id: null, totalCollected: { $sum: "$amount" } } },
      ]),
      RegistrationRequest.countDocuments({ schoolId, status: "Pending" }),
      Complaint.countDocuments({ schoolId, status: { $ne: "Resolved" } }),
      TeacherAttendance.find({ schoolId, date: today }),
      Attendance.aggregate([
        { $match: { schoolId, date: today } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Notice.find({ schoolId }).sort({ createdAt: -1 }).limit(5),
      Exam.find({ schoolId, endDate: { $gte: startOfToday } })
        .sort({ startDate: 1 })
        .limit(5),
      TeacherAttendance.countDocuments({ schoolId, status: "Leave" }),
      AuditLog.find({ schoolId })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("userId", "name role"),
    ]);

    // Student attendance calculation
    let presentStudents = 0;
    let absentStudents = 0;
    let leaveStudents = 0;
    todayStudentAtt.forEach((rec) => {
      if (rec._id === "Present") presentStudents = rec.count;
      else if (rec._id === "Absent") absentStudents = rec.count;
      else if (rec._id === "Leave") leaveStudents = rec.count;
    });

    const totalAttendanceMarked = presentStudents + absentStudents + leaveStudents;
    const attendancePercentage =
      totalAttendanceMarked > 0
        ? Math.round((presentStudents / totalAttendanceMarked) * 100)
        : 0;

    // Faculty attendance
    const presentTeachers = todayTeacherAtt.filter((t) => t.status === "Present").length;

    // Fee calculations
    const totalCollected = feePayments[0]?.totalCollected || 0;
    const avgFeeStructure = feeStructures.reduce((sum, f) => sum + (f.amount || 0), 0);
    const totalExpected = (avgFeeStructure || 0) * (totalStudents || 0);
    const pendingFees = Math.max(0, totalExpected - totalCollected);

    return res.status(200).json({
      success: true,
      message: "Principal dashboard metrics calculated successfully",
      data: {
        totalStudents,
        totalTeachers,
        totalStaff: totalTeachers,
        attendance: {
          present: presentStudents,
          absent: absentStudents,
          leave: leaveStudents,
          percentage: attendancePercentage,
          totalMarked: totalAttendanceMarked,
          date: today,
        },
        fees: {
          totalExpected,
          totalCollected,
          pendingFees,
          structuresCount: feeStructures.length,
        },
        academic: {
          classesCount: totalClasses,
          sectionsCount: totalSections,
          subjectsCount: totalSubjects,
        },
        staff: {
          total: totalTeachers,
          present: presentTeachers,
          notCheckedIn: Math.max(0, totalTeachers - presentTeachers),
        },
        pendingApprovals,
        unresolvedComplaints,
        recentNotices,
        upcomingExams: upcomingExams || [],
        pendingLeaves: pendingLeaves || 0,
        recentActivities: recentActivities || [],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to compute Principal dashboard metrics",
      error: error.message,
    });
  }
};
