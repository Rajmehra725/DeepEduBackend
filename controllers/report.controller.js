import Report from "../models/report.model.js";
import AuditLog from "../models/auditLog.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Moment from "../models/moment.model.js";

/**
 * Submit a report for a user, group, or message
 */
export const submitReport = async (req, res) => {
  try {
    const { targetType, targetId, targetUserId, reason, details } = req.body;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({
        success: false,
        message: "targetType, targetId, and reason are required",
      });
    }

    const report = new Report({
      reporter: req.user._id,
      targetType,
      targetId,
      targetUser: targetUserId || undefined,
      reason: reason.trim(),
      details: details ? details.trim() : "",
      status: "pending",
    });

    await report.save();

    return res.status(201).json({
      success: true,
      message: "Report submitted to safety team for review",
      report,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Get all reports with optional status and pagination
 */
export const getAdminReports = async (req, res) => {
  try {
    const { status = "", page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Report.countDocuments(filter);
    const reports = await Report.find(filter)
      .populate("reporter", "fullName username profileImage")
      .populate("targetUser", "fullName username profileImage isBanned isSuspended")
      .populate("resolvedBy", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      reports,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Resolve or dismiss report with optional direct action
 */
export const resolveReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status = "action_taken", actionNote = "", moderationAction = "" } = req.body;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    // Execute direct moderation action if specified
    if (moderationAction === "suspend_user" && report.targetUser) {
      await User.findByIdAndUpdate(report.targetUser, { isSuspended: true });
    } else if (moderationAction === "ban_user" && report.targetUser) {
      await User.findByIdAndUpdate(report.targetUser, { isBanned: true, banReason: report.reason });
    } else if (moderationAction === "delete_content") {
      if (report.targetType === "message") {
        await Message.findByIdAndUpdate(report.targetId, {
          isDeletedForEveryone: true,
          text: "This message was removed by moderation",
          attachments: [],
        });
      } else if (report.targetType === "moment") {
        await Moment.findByIdAndDelete(report.targetId);
      }
    }

    report.status = status;
    report.actionNote = actionNote;
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();
    await report.save();

    await AuditLog.create({
      admin: req.user._id,
      action: "RESOLVE_REPORT",
      targetType: "Report",
      targetId: reportId,
      details: { status, actionNote, moderationAction },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: "Report status updated and moderation action recorded",
      report,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
