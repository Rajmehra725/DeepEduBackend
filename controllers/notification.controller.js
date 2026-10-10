import Notification from "../models/notification.model.js";

/**
 * Get user's notifications
 */
export const getMyNotifications = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({ recipient: currentUserId })
      .populate("sender", "fullName username profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({
      recipient: currentUserId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Mark a single notification as read
 */
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    await Notification.findOneAndUpdate(
      { _id: id, recipient: currentUserId },
      { isRead: true }
    );

    return res.status(200).json({ success: true, message: "Marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    await Notification.updateMany(
      { recipient: currentUserId, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
