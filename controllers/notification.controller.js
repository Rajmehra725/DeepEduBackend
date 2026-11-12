import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendPushToUsers } from "../utils/pushNotifier.js";

/**
 * Get Paginated Notifications for Current User
 */
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 50, type, unreadOnly } = req.query;

    const query = { recipientId: userId };
    if (type && type !== "All") {
      query.type = type;
    }
    if (unreadOnly === "true") {
      query.isRead = false;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId: userId, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
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
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

/**
 * Get Fast Unread Count for Header Badge
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
      error: error.message,
    });
  }
};

/**
 * Mark Single Notification as Read
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { isRead: true },
      { new: true }
    );

    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      data: {
        notification,
        unreadCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

/**
 * Mark All Notifications as Read
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: { unreadCount: 0 },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark all as read",
      error: error.message,
    });
  }
};

/**
 * Register Mobile Device Push Token (Expo)
 */
export const registerDeviceToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { token, platform = "android" } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid device push token is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.deviceTokens) {
      user.deviceTokens = [];
    }

    // Check if token is already registered
    const existingIndex = user.deviceTokens.findIndex((d) => d.token === token);
    if (existingIndex >= 0) {
      user.deviceTokens[existingIndex].updatedAt = new Date();
      user.deviceTokens[existingIndex].platform = platform;
    } else {
      user.deviceTokens.push({ token, platform, updatedAt: new Date() });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Device registered for push notifications successfully",
    });
  } catch (error) {
    console.error("registerDeviceToken error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register push token",
      error: error.message,
    });
  }
};

/**
 * Unregister Mobile Device Push Token on Sign Out
 */
export const unregisterDeviceToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { token } = req.body;

    if (token) {
      await User.findByIdAndUpdate(userId, {
        $pull: { deviceTokens: { token } },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Device push token unregistered successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to unregister push token",
      error: error.message,
    });
  }
};

/**
 * Broadcast School Announcement Notification with Push Delivery (Principal/Admin)
 */
export const broadcastNotification = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { title, message, targetAudience = "all", linkUrl = "" } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required for broadcast",
      });
    }

    const query = { schoolId };
    if (targetAudience === "teachers") {
      query.role = "teacher";
    } else if (targetAudience === "parents") {
      query.role = "parent";
    } else if (targetAudience === "students") {
      query.role = "student";
    } else if (targetAudience !== "all") {
      query.role = targetAudience;
    }

    const targetUsers = await User.find(query).select("_id");
    const recipientIds = targetUsers.map((u) => u._id);

    if (recipientIds.length > 0) {
      const records = recipientIds.map((rId) => ({
        schoolId,
        recipientId: rId,
        title: title.trim(),
        message: message.trim(),
        type: "Notice",
        linkUrl,
      }));

      await Notification.insertMany(records);

      // Asynchronously dispatch Expo push notifications
      sendPushToUsers(recipientIds, {
        title: title.trim(),
        body: message.trim(),
        data: { linkUrl, type: "Notice" },
      }).catch((err) => console.error("Push dispatch error:", err));
    }

    return res.status(200).json({
      success: true,
      message: `Notification broadcasted to ${recipientIds.length} users successfully`,
      data: { recipientsCount: recipientIds.length },
    });
  } catch (error) {
    console.error("broadcastNotification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to broadcast notification",
      error: error.message,
    });
  }
};
