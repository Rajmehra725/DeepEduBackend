import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import Report from "../models/report.model.js";
import AuditLog from "../models/auditLog.model.js";
import Announcement from "../models/announcement.model.js";
import Moment from "../models/moment.model.js";
import Setting from "../models/setting.model.js";
import Card from "../models/Card.js";

/**
 * Default System Settings Initializer
 */
const ensureDefaultSettings = async (adminId) => {
  const defaults = [
    { key: "MAINTENANCE_MODE", value: false, type: "boolean", description: "Put platform in maintenance mode", category: "security" },
    { key: "MAX_GROUP_MEMBERS", value: 256, type: "number", description: "Maximum members allowed per group", category: "limits" },
    { key: "ALLOW_MOMENT_UPLOADS", value: true, type: "boolean", description: "Allow users to post 24-hour stories", category: "features" },
    { key: "ENABLE_NEW_REGISTRATIONS", value: true, type: "boolean", description: "Allow new users to register", category: "general" },
    { key: "MAX_MEDIA_UPLOAD_MB", value: 50, type: "number", description: "Maximum media upload size in megabytes", category: "limits" },
    { key: "SUPPORT_RAAZ_ID", value: "@raaz_support", type: "string", description: "Official support Raaz ID handle", category: "general" },
  ];

  for (const item of defaults) {
    const existing = await Setting.findOne({ key: item.key });
    if (!existing) {
      await Setting.create({ ...item, updatedBy: adminId || null });
    }
  }
};

/**
 * 1. Admin Dashboard Metrics (Real MongoDB aggregations)
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
    const totalMoments = await Moment.countDocuments();
    const totalAnnouncements = await Announcement.countDocuments();

    // Recent registered users preview
    const recentUsers = await User.find()
      .select("fullName username phone role isOnline isBanned isSuspended createdAt profileImage")
      .sort({ createdAt: -1 })
      .limit(6);

    // Recent reports preview
    const recentReports = await Report.find()
      .populate("reporter", "fullName username profileImage")
      .populate("targetUser", "fullName username profileImage")
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
        totalMoments,
        totalAnnouncements,
      },
      recentUsers,
      recentReports,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Deep Analytics for Saved Reports & Charts
 */
export const getAdminAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // User growth by day (last 7 days)
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Role distribution
    const roleDistribution = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    // Conversation types breakdown
    const conversationTypes = await Conversation.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    // Report status breakdown
    const reportBreakdown = await Report.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      success: true,
      analytics: {
        userGrowth,
        roleDistribution,
        conversationTypes,
        reportBreakdown,
        generatedAt: now,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. User Management: Paginated List & Search
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
    if (status === "active") {
      query.isBanned = false;
      query.isSuspended = false;
    }

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
 * 4. User Details
 */
export const getAdminUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const messageCount = await Message.countDocuments({ sender: userId });
    const conversationCount = await Conversation.countDocuments({ participants: userId });
    const reportsAgainstUser = await Report.countDocuments({ targetUser: userId });

    return res.status(200).json({
      success: true,
      user,
      stats: {
        messageCount,
        conversationCount,
        reportsAgainstUser,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Update Permitted User Profile Fields (Admin)
 */
export const updateAdminUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, bio, gender, isVerified } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (fullName) user.fullName = fullName.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (gender) user.gender = gender;
    if (isVerified !== undefined) user.isVerified = Boolean(isVerified);

    await user.save();

    await AuditLog.create({
      admin: req.user._id,
      action: "UPDATE_USER_PROFILE",
      targetType: "User",
      targetId: userId,
      details: { fullName, isVerified },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Suspend / Unsuspend User
 */
export const toggleSuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = "" } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "super_admin" || user.isPrimarySuperAdmin) {
      return res.status(403).json({ success: false, message: "Cannot suspend a Super Admin account" });
    }

    if (user.role === "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Only Super Admin can suspend administrators" });
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
 * 7. Ban / Unban User
 */
export const toggleBanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { banReason = "Violation of terms" } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "super_admin" || user.isPrimarySuperAdmin) {
      return res.status(403).json({ success: false, message: "Cannot ban a Super Admin account" });
    }

    if (user.role === "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Only Super Admin can ban administrators" });
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
 * 8. Delete User Account (Super Admin Protected)
 */
export const deleteAdminUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user._id.toString() === userId.toString()) {
      return res.status(400).json({ success: false, message: "Cannot delete your own account from admin panel" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isPrimarySuperAdmin || user.role === "super_admin") {
      return res.status(403).json({ success: false, message: "Primary Super Admin account cannot be deleted" });
    }

    if (user.role === "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Only Super Admin can delete administrator accounts" });
    }

    const deletedUsername = user.username;
    await User.findByIdAndDelete(userId);

    await AuditLog.create({
      admin: req.user._id,
      action: "DELETE_USER",
      targetType: "User",
      targetId: userId,
      details: { deletedUsername },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: `User @${deletedUsername} has been permanently deleted`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 9. Role Assignment & Management (Super Admin Only)
 */
export const changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["user", "moderator", "admin", "super_admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role specified" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isPrimarySuperAdmin && role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Primary Super Admin cannot be demoted to prevent system lockout",
      });
    }

    const previousRole = user.role;
    user.role = role;
    await user.save();

    await AuditLog.create({
      admin: req.user._id,
      action: "CHANGE_USER_ROLE",
      targetType: "User",
      targetId: userId,
      details: { previousRole, newRole: role, username: user.username },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: `Role for @${user.username} updated to ${role}`,
      user,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 10. List Administrators & Roles
 */
export const getAdminAccounts = async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ["moderator", "admin", "super_admin"] },
    })
      .select("fullName username phone role isPrimarySuperAdmin isOnline lastSeen createdAt profileImage")
      .sort({ role: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      admins,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 11. Group Management: List & Search
 */
export const getAdminGroups = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", category = "" } = req.query;

    const query = { type: { $in: ["group", "circle"] } };
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (category) {
      query.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Conversation.countDocuments(query);
    const groups = await Conversation.find(query)
      .populate("admins", "fullName username profileImage")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const enriched = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      description: g.description,
      category: g.category,
      avatar: g.avatar,
      type: g.type,
      participantsCount: g.participants.length,
      admins: g.admins,
      adminOnlyMessaging: g.adminOnlyMessaging,
      createdAt: g.createdAt,
      lastMessageAt: g.lastMessageAt,
    }));

    return res.status(200).json({
      success: true,
      groups: enriched,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 12. Group Details
 */
export const getAdminGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Conversation.findById(groupId)
      .populate("participants", "fullName username phone profileImage role isOnline")
      .populate("admins", "fullName username profileImage");

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const messageCount = await Message.countDocuments({ conversation: groupId });

    return res.status(200).json({
      success: true,
      group,
      messageCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 13. Create Group (Admin)
 */
export const createAdminGroup = async (req, res) => {
  try {
    const { name, description = "", category = "general", type = "group" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    const group = new Conversation({
      type: type === "circle" ? "circle" : "group",
      name: name.trim(),
      description: description.trim(),
      category,
      participants: [req.user._id],
      admins: [req.user._id],
      lastMessageText: "Official group created by Admin",
      lastMessageAt: new Date(),
    });

    await group.save();

    await AuditLog.create({
      admin: req.user._id,
      action: "CREATE_GROUP",
      targetType: "Conversation",
      targetId: group._id.toString(),
      details: { name: group.name, type: group.type },
      ipAddress: req.ip || "",
    });

    return res.status(201).json({
      success: true,
      message: "Group created successfully",
      group,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 14. Update Group Settings (Admin)
 */
export const updateAdminGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, category, adminOnlyMessaging } = req.body;

    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (category) group.category = category;
    if (adminOnlyMessaging !== undefined) group.adminOnlyMessaging = Boolean(adminOnlyMessaging);

    await group.save();

    await AuditLog.create({
      admin: req.user._id,
      action: "UPDATE_GROUP",
      targetType: "Conversation",
      targetId: groupId,
      details: { name: group.name },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: "Group updated successfully",
      group,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 15. Delete Group (Admin)
 */
export const deleteAdminGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const groupName = group.name;
    await Message.deleteMany({ conversation: groupId });
    await Conversation.findByIdAndDelete(groupId);

    await AuditLog.create({
      admin: req.user._id,
      action: "DELETE_GROUP",
      targetType: "Conversation",
      targetId: groupId,
      details: { name: groupName },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: `Group "${groupName}" deleted successfully`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 16. Manage Group Membership (Add/Remove)
 */
export const addAdminGroupMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!group.participants.includes(userId)) {
      group.participants.push(userId);
      await group.save();
    }

    return res.status(200).json({
      success: true,
      message: "Member added successfully",
      participantsCount: group.participants.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const removeAdminGroupMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;

    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    group.participants = group.participants.filter(
      (p) => p.toString() !== memberId.toString()
    );
    group.admins = group.admins.filter(
      (a) => a.toString() !== memberId.toString()
    );
    await group.save();

    return res.status(200).json({
      success: true,
      message: "Member removed from group",
      participantsCount: group.participants.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 17. Moments Moderation: List & Delete
 */
export const getAdminMoments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const total = await Moment.countDocuments();
    const moments = await Moment.find()
      .populate("user", "fullName username profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      moments,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdminMoment = async (req, res) => {
  try {
    const { momentId } = req.params;
    const { reason = "Content violation" } = req.body;

    const moment = await Moment.findById(momentId).populate("user", "username");
    if (!moment) {
      return res.status(404).json({ success: false, message: "Moment not found" });
    }

    const authorUsername = moment.user?.username || "unknown";
    await Moment.findByIdAndDelete(momentId);

    await AuditLog.create({
      admin: req.user._id,
      action: "DELETE_MOMENT",
      targetType: "Moment",
      targetId: momentId,
      details: { reason, authorUsername },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: "Moment deleted by moderator",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 18. Notification Campaigns CRUD (Module 7)
 */
export const getAdminNotifications = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Announcement.countDocuments(filter);
    const notifications = await Announcement.find(filter)
      .populate("createdBy", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      notifications,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAdminNotification = async (req, res) => {
  try {
    const { title, message, priority = "normal", targetAudience = "all", isDraft = false, scheduledAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    let status = isDraft ? "draft" : "sent";
    let scheduledDate = null;

    if (scheduledAt) {
      scheduledDate = new Date(scheduledAt);
      if (scheduledDate > new Date()) {
        status = "scheduled";
      }
    }

    const countUsers = await User.countDocuments();

    const notification = new Announcement({
      title: title.trim(),
      message: message.trim(),
      priority,
      targetAudience,
      status,
      scheduledAt: scheduledDate,
      sentAt: status === "sent" ? new Date() : null,
      recipientsCount: status === "sent" ? countUsers : 0,
      deliveryStatus: status === "sent" ? "completed" : "pending",
      createdBy: req.user._id,
    });

    await notification.save();

    await AuditLog.create({
      admin: req.user._id,
      action: status === "sent" ? "SEND_NOTIFICATION" : "CREATE_NOTIFICATION_DRAFT",
      targetType: "Announcement",
      targetId: notification._id.toString(),
      details: { title, status },
      ipAddress: req.ip || "",
    });

    if (status === "sent") {
      const io = req.app.get("io");
      if (io) {
        io.emit("newAnnouncement", notification);
      }
    }

    return res.status(201).json({
      success: true,
      message: status === "sent" ? "Notification campaign broadcast successfully" : "Notification draft saved",
      notification,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, priority, targetAudience } = req.body;

    const notif = await Announcement.findById(id);
    if (!notif) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    if (notif.status === "sent") {
      return res.status(400).json({ success: false, message: "Cannot edit an already sent notification" });
    }

    if (title) notif.title = title.trim();
    if (message) notif.message = message.trim();
    if (priority) notif.priority = priority;
    if (targetAudience) notif.targetAudience = targetAudience;

    await notif.save();

    return res.status(200).json({
      success: true,
      message: "Notification draft updated",
      notification: notif,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdminNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Announcement.findById(id);
    if (!notif) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    await Announcement.findByIdAndDelete(id);

    await AuditLog.create({
      admin: req.user._id,
      action: "DELETE_NOTIFICATION",
      targetType: "Announcement",
      targetId: id,
      details: { title: notif.title },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: "Notification removed",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const sendAdminNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Announcement.findById(id);
    if (!notif) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    const countUsers = await User.countDocuments();
    notif.status = "sent";
    notif.sentAt = new Date();
    notif.recipientsCount = countUsers;
    notif.deliveryStatus = "completed";
    await notif.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("newAnnouncement", notif);
    }

    await AuditLog.create({
      admin: req.user._id,
      action: "BROADCAST_NOTIFICATION",
      targetType: "Announcement",
      targetId: id,
      details: { title: notif.title, recipientsCount: countUsers },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: "Notification dispatched to all connected clients",
      notification: notif,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelAdminNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Announcement.findById(id);
    if (!notif) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    notif.status = "cancelled";
    notif.deliveryStatus = "cancelled";
    await notif.save();

    return res.status(200).json({
      success: true,
      message: "Scheduled notification cancelled",
      notification: notif,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 19. Application Settings CRUD (Module 8)
 */
export const getAdminSettings = async (req, res) => {
  try {
    await ensureDefaultSettings(req.user._id);

    const settings = await Setting.find()
      .populate("updatedBy", "fullName username")
      .sort({ category: 1, key: 1 });

    return res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    let setting = await Setting.findOne({ key: key.toUpperCase() });
    if (!setting) {
      setting = new Setting({
        key: key.toUpperCase(),
        value,
        description: description || "",
        updatedBy: req.user._id,
      });
    } else {
      setting.value = value;
      if (description) setting.description = description;
      setting.updatedBy = req.user._id;
    }

    await setting.save();

    await AuditLog.create({
      admin: req.user._id,
      action: "UPDATE_SETTING",
      targetType: "Setting",
      targetId: setting._id.toString(),
      details: { key: setting.key, newValue: value },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      success: true,
      message: `Setting ${setting.key} updated`,
      setting,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 20. Content Management: Survey Cards CMS
 */
export const getAdminCards = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Card.countDocuments(filter);
    const cards = await Card.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      cards,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminCardStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid card status" });
    }

    const card = await Card.findByIdAndUpdate(id, { status }, { new: true });
    if (!card) {
      return res.status(404).json({ success: false, message: "Card not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Card status updated to ${status}`,
      card,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdminCard = async (req, res) => {
  try {
    const { id } = req.params;
    const card = await Card.findByIdAndDelete(id);
    if (!card) {
      return res.status(404).json({ success: false, message: "Card not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Card deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 21. Audit Logs (Protected Read)
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action = "" } = req.query;

    const query = {};
    if (action) query.action = action;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate("admin", "fullName username role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      logs,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Legacy exports for backwards compatibility
export const createAnnouncement = createAdminNotification;
export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true, status: "sent" })
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
