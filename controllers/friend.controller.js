import FriendRequest from "../models/friendRequest.model.js";
import User from "../models/user.model.js";

/**
 * Send a friend request
 */
export const sendFriendRequest = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: "recipientId is required" });
    }

    if (senderId.toString() === recipientId.toString()) {
      return res.status(400).json({ success: false, message: "You cannot add yourself" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient user not found" });
    }

    // Check if recipient has blocked sender or vice versa
    if (recipient.blockedUsers?.includes(senderId) || req.user.blockedUsers?.includes(recipientId)) {
      return res.status(403).json({ success: false, message: "Unable to send friend request" });
    }

    // Check existing request
    const existing = await FriendRequest.findOne({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId },
      ],
    });

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(400).json({ success: false, message: "You are already friends" });
      }
      if (existing.status === "pending") {
        return res.status(400).json({ success: false, message: "Friend request already pending" });
      }
      // If was rejected or cancelled, reopen it
      existing.sender = senderId;
      existing.recipient = recipientId;
      existing.status = "pending";
      await existing.save();

      return res.status(200).json({
        success: true,
        message: "Friend request sent",
        friendRequest: existing,
      });
    }

    const friendRequest = new FriendRequest({
      sender: senderId,
      recipient: recipientId,
      status: "pending",
    });

    await friendRequest.save();

    return res.status(201).json({
      success: true,
      message: "Friend request sent successfully",
      friendRequest,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Accept a friend request
 */
export const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to accept this request" });
    }

    request.status = "accepted";
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Friend request accepted! You are now connected.",
      friendRequest: request,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject a friend request
 */
export const rejectFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    request.status = "rejected";
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Friend request rejected",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancel an outgoing friend request
 */
export const cancelFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    request.status = "cancelled";
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Friend request cancelled",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove an existing friend
 */
export const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    await FriendRequest.findOneAndDelete({
      status: "accepted",
      $or: [
        { sender: userId, recipient: friendId },
        { sender: friendId, recipient: userId },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Friend removed",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all friends and pending requests
 */
export const getFriendsAndRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    // Accepted friends
    const acceptedRequests = await FriendRequest.find({
      status: "accepted",
      $or: [{ sender: userId }, { recipient: userId }],
    })
      .populate("sender", "fullName username profileImage isOnline lastSeen privacySettings")
      .populate("recipient", "fullName username profileImage isOnline lastSeen privacySettings");

    const friends = acceptedRequests.map((reqItem) => {
      const isSender = reqItem.sender._id.toString() === userId.toString();
      const friendUser = isSender ? reqItem.recipient : reqItem.sender;
      const showOnline =
        !friendUser?.privacySettings?.ghostMode &&
        friendUser?.privacySettings?.showOnline !== false;

      return {
        _id: friendUser?._id,
        fullName: friendUser?.fullName,
        username: friendUser?.username,
        profileImage: friendUser?.profileImage,
        isOnline: showOnline ? friendUser?.isOnline : false,
        friendshipId: reqItem._id,
      };
    }).filter(f => f._id);

    // Incoming pending requests
    const incoming = await FriendRequest.find({
      recipient: userId,
      status: "pending",
    }).populate("sender", "fullName username profileImage bio");

    // Outgoing pending requests
    const outgoing = await FriendRequest.find({
      sender: userId,
      status: "pending",
    }).populate("recipient", "fullName username profileImage bio");

    return res.status(200).json({
      success: true,
      friends,
      incoming,
      outgoing,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
