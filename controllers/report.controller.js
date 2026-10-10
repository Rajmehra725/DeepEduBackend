import Report from "../models/report.model.js";
import AuditLog from "../models/auditLog.model.js";

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
 * Admin: Get all reports
 */
export const getAdminReports = async (req, res) => {
  try {
    const { status = "pending" } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const reports = await Report.find(filter)
      .populate("reporter", "fullName username profileImage")
      .populate("targetUser", "fullName username profileImage isBanned isSuspended")
      .populate("resolvedBy", "fullName username")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      reports,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Resolve or dismiss report
 */
export const resolveReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status = "action_taken", actionNote = "" } = req.body;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
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
      details: { status, actionNote },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: "Report status updated",
      report,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
