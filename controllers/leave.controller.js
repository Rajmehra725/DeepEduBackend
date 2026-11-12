import LeaveApplication from "../models/LeaveApplication.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import AuditLog from "../models/AuditLog.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendPushToUsers } from "../utils/pushNotifier.js";

/**
 * Apply for formal leave (Teacher or Student)
 */
export const applyLeave = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const role = req.user.role;
    const {
      leaveType = "Casual Leave",
      startDate,
      endDate,
      reason,
      documentUrl = "",
    } = req.body;

    if (!startDate || !endDate || !reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "startDate, endDate, and reason are required",
      });
    }

    let teacherId = null;
    let studentId = null;
    let applicantName = req.user.name || "Staff Member";

    if (role === "teacher") {
      const teacher = await Teacher.findOne({ userId, schoolId });
      if (teacher) {
        teacherId = teacher._id;
        applicantName = `${teacher.firstName} ${teacher.lastName || ""}`.trim();
      }
    } else if (role === "student") {
      const student = await Student.findOne({ userId, schoolId });
      if (student) {
        studentId = student._id;
        applicantName = `${student.firstName} ${student.lastName || ""}`.trim();
      }
    }

    // Calculate days count
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const daysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const leave = await LeaveApplication.create({
      schoolId,
      applicantId: userId,
      teacherId,
      studentId,
      applicantRole: role === "student" ? "student" : "teacher",
      applicantName,
      leaveType,
      startDate,
      endDate,
      daysCount,
      reason: reason.trim(),
      documentUrl,
      status: "Pending",
    });

    // Notify School Principal
    const principals = await User.find({ schoolId, role: "principal" });
    for (const p of principals) {
      await Notification.create({
        schoolId,
        recipientId: p._id,
        title: `Leave Application: ${applicantName}`,
        message: `${applicantName} has applied for ${daysCount} day(s) ${leaveType} (${startDate} to ${endDate}). Reason: ${reason.trim()}`,
        type: "Leave",
      });
    }

    sendPushToUsers(
      principals.map((p) => p._id),
      {
        title: `Leave Application: ${applicantName}`,
        body: `${applicantName} applied for ${leaveType} (${startDate} to ${endDate}).`,
        data: { screen: "approval-center", type: "Leave" },
      }
    ).catch(() => {});

    await AuditLog.create({
      schoolId,
      userId,
      action: "LEAVE_APPLIED",
      entity: "LeaveApplication",
      entityId: leave._id,
      details: { applicantName, leaveType, startDate, endDate, daysCount },
    });

    return res.status(201).json({
      success: true,
      message: "Leave application submitted successfully for administrative review",
      data: leave,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit leave application",
      error: error.message,
    });
  }
};

/**
 * Get authenticated user's leave history
 */
export const getMyLeaves = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;

    const leaves = await LeaveApplication.find({
      schoolId,
      applicantId: userId,
    }).sort({ createdAt: -1 });

    const pendingCount = leaves.filter((l) => l.status === "Pending").length;
    const approvedCount = leaves.filter((l) => l.status === "Approved").length;
    const rejectedCount = leaves.filter((l) => l.status === "Rejected").length;

    return res.status(200).json({
      success: true,
      data: {
        leaves,
        summary: {
          total: leaves.length,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave history",
      error: error.message,
    });
  }
};

/**
 * Cancel an applicant's own pending leave
 */
export const cancelLeave = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const userId = req.user._id;
    const { id } = req.params;

    const leave = await LeaveApplication.findOne({
      _id: id,
      schoolId,
      applicantId: userId,
    });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave application not found",
      });
    }

    if (leave.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a leave application that is already ${leave.status}`,
      });
    }

    leave.status = "Cancelled";
    await leave.save();

    return res.status(200).json({
      success: true,
      message: "Leave application cancelled successfully",
      data: leave,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to cancel leave application",
      error: error.message,
    });
  }
};

/**
 * Principal / SuperAdmin: List all school leave applications
 */
export const getSchoolLeaves = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { status, role } = req.query;

    const query = { schoolId };
    if (status && status !== "all") query.status = status;
    if (role && role !== "all") query.applicantRole = role;

    const leaves = await LeaveApplication.find(query)
      .populate("teacherId", "firstName lastName employeeId designation")
      .populate("studentId", "firstName lastName admissionNumber rollNumber classId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch school leave applications",
      error: error.message,
    });
  }
};

/**
 * Principal: Approve or Reject a leave application
 */
export const reviewLeave = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const reviewerId = req.user._id;
    const { id } = req.params;
    const { status, remarks = "" } = req.body;

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'Approved' or 'Rejected'",
      });
    }

    const leave = await LeaveApplication.findOne({ _id: id, schoolId });
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave application not found",
      });
    }

    leave.status = status;
    leave.reviewedBy = reviewerId;
    leave.reviewedAt = new Date();
    leave.reviewerRemarks = remarks.trim();
    await leave.save();

    // Notify applicant
    await Notification.create({
      schoolId,
      recipientId: leave.applicantId,
      title: `Leave Application ${status}`,
      message: `Your ${leave.leaveType} application for ${leave.startDate} to ${leave.endDate} has been ${status.toLowerCase()} by administration.${remarks ? ` Remarks: ${remarks}` : ""}`,
      type: "Leave",
    });

    sendPushToUsers(leave.applicantId, {
      title: `Leave Application ${status}`,
      body: `Your ${leave.leaveType} has been ${status.toLowerCase()}.`,
      data: { screen: "staff-attendance", type: "Leave" },
    }).catch(() => {});

    await AuditLog.create({
      schoolId,
      userId: reviewerId,
      action: `LEAVE_${status.toUpperCase()}`,
      entity: "LeaveApplication",
      entityId: leave._id,
      details: { applicantName: leave.applicantName, status, remarks },
    });

    return res.status(200).json({
      success: true,
      message: `Leave application successfully ${status.toLowerCase()}`,
      data: leave,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to review leave application",
      error: error.message,
    });
  }
};
