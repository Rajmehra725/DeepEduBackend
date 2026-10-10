import Moment from "../models/moment.model.js";
import FriendRequest from "../models/friendRequest.model.js";

/**
 * Create a new Raaz Moment
 */
export const createMoment = async (req, res) => {
  try {
    const {
      type = "text",
      text = "",
      mediaUrl = "",
      backgroundColor = "#FF7A00",
      audience = "friends",
      allowedViewers = [],
    } = req.body;

    const currentUserId = req.user._id;

    if (type === "text" && !text.trim()) {
      return res.status(400).json({ success: false, message: "Moment text is required" });
    }

    if ((type === "image" || type === "video") && !mediaUrl) {
      return res.status(400).json({ success: false, message: "Media URL is required" });
    }

    // 24-hour expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const moment = new Moment({
      user: currentUserId,
      type,
      text: text.trim(),
      mediaUrl,
      backgroundColor,
      audience,
      allowedViewers,
      expiresAt,
    });

    await moment.save();

    const populated = await Moment.findById(moment._id).populate(
      "user",
      "fullName username profileImage"
    );

    return res.status(201).json({
      success: true,
      message: "Raaz Moment shared successfully",
      moment: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get active Raaz Moments feed (from friends and self)
 */
export const getMomentsFeed = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get friend IDs
    const friendships = await FriendRequest.find({
      status: "accepted",
      $or: [{ sender: currentUserId }, { recipient: currentUserId }],
    });

    const friendIds = friendships.map((f) =>
      f.sender.toString() === currentUserId.toString()
        ? f.recipient.toString()
        : f.sender.toString()
    );

    const visibleUserIds = [currentUserId, ...friendIds];

    const now = new Date();

    const moments = await Moment.find({
      user: { $in: visibleUserIds },
      expiresAt: { $gt: now },
    })
      .populate("user", "fullName username profileImage")
      .populate("viewers.user", "fullName username profileImage")
      .populate("reactions.user", "fullName username profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      moments,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Record view on a moment
 */
export const viewMoment = async (req, res) => {
  try {
    const { momentId } = req.params;
    const currentUserId = req.user._id;

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ success: false, message: "Moment not found" });
    }

    const alreadyViewed = moment.viewers.some(
      (v) => v.user.toString() === currentUserId.toString()
    );

    if (!alreadyViewed) {
      moment.viewers.push({ user: currentUserId, viewedAt: new Date() });
      await moment.save();
    }

    return res.status(200).json({
      success: true,
      viewersCount: moment.viewers.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * React to a moment
 */
export const reactToMoment = async (req, res) => {
  try {
    const { momentId } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.user._id;

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ success: false, message: "Moment not found" });
    }

    moment.reactions = moment.reactions.filter(
      (r) => r.user.toString() !== currentUserId.toString()
    );

    if (emoji) {
      moment.reactions.push({ user: currentUserId, emoji });
    }

    await moment.save();

    return res.status(200).json({
      success: true,
      reactions: moment.reactions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete own moment
 */
export const deleteMoment = async (req, res) => {
  try {
    const { momentId } = req.params;
    const currentUserId = req.user._id;

    const moment = await Moment.findOneAndDelete({
      _id: momentId,
      user: currentUserId,
    });

    if (!moment) {
      return res.status(404).json({ success: false, message: "Moment not found or unauthorized" });
    }

    return res.status(200).json({
      success: true,
      message: "Moment deleted",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
