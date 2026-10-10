import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import Report from "../models/report.model.js";
import AuditLog from "../models/auditLog.model.js";
import Announcement from "../models/announcement.model.js";

/**
 * Get comprehensive Admin Dashboard metrics from real database queries
 */
export const getAdminMetrics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isOnline: true });
    const suspendedUsers = await User.countDocuments({ isSuspended: true });
    const bannedUsers = await User.countDocuments({ isBanned: true });

    // New registrations in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newRegistrations = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    const totalConversations = await Conversation.countDocuments();
    const groupsAndCircles = await Conversation.countDocuments({
      type: { $in: ["group", "circle"] },
    });

    const totalMessages = await Message.countDocuments();
    const pendingReports = await Report.countDocuments({ status: "pending" });

    // Recent registered users preview
    const recentUsers = await User.find()
      .select("fullName username phone role isOnline isBanned isSuspended createdAt")
      .sort({ createdAt: -1 })
      .limit(6);

    // Recent reports preview
    const recentReports = await Report.find()
      .populate("reporter", "fullName username")
      .populate("targetUser", "fullName username")
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      metrics: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        bannedUsers,
        newRegistrations,
        totalConversations,
        groupsAndCircles,
        totalMessages,
        pendingReports,
      },
      recentUsers,
      recentReports,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get list of all users with search and pagination for Admin
 */
export const getAdminUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", role = "", status = "" } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (role) query.role = role;
    if (status === "banned") query.isBanned = true;
    if (status === "suspended") query.isSuspended = true;
    if (status === "active") query.isBanned = false;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      users,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Suspend or Unsuspend User
 */
export const toggleSuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = "" } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "Cannot suspend administrator account" });
    }

    user.isSuspended = !user.isSuspended;
    await user.save();

    await AuditLog.create({
      admin: req.user._id,
      action: user.isSuspended ? "SUSPEND_USER" : "UNSUSPEND_USER",
      targetType: "User",
      targetId: userId,
      details: { reason, targetUsername: user.username },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: `User @${user.username} has been ${user.isSuspended ? "suspended" : "unsuspended"}`,
      isSuspended: user.isSuspended,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Ban or Unban User
 */
export const toggleBanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { banReason = "Violation of terms" } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "Cannot ban administrator account" });
    }

    user.isBanned = !user.isBanned;
    user.banReason = user.isBanned ? banReason : "";
    await user.save();

    await AuditLog.create({
      admin: req.user._id,
      action: user.isBanned ? "BAN_USER" : "UNBAN_USER",
      targetType: "User",
      targetId: userId,
      details: { banReason, targetUsername: user.username },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: `User @${user.username} has been ${user.isBanned ? "banned" : "unbanned"}`,
      isBanned: user.isBanned,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create Platform Announcement
 */
export const createAnnouncement = async (req, res) => {
  try {
    const { title, message, priority = "normal" } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    const announcement = new Announcement({
      title: title.trim(),
      message: message.trim(),
      priority,
      createdBy: req.user._id,
    });

    await announcement.save();

    await AuditLog.create({
      admin: req.user._id,
      action: "CREATE_ANNOUNCEMENT",
      targetType: "Announcement",
      targetId: announcement._id.toString(),
      details: { title },
      ipAddress: req.ip || "",
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("newAnnouncement", announcement);
    }

    return res.status(201).json({
      success: true,
      message: "Announcement posted successfully",
      announcement,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * List Announcements
 */
export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate("createdBy", "fullName username")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      announcements,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * List Audit Logs
 */
export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate("admin", "fullName username")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      logs,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
