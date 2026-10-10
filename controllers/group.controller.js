import Conversation from "../models/conversation.model.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new Group or Circle Chat
 */
export const createGroup = async (req, res) => {
  try {
    const {
      name,
      description,
      category = "general",
      type = "group",
      avatar = "",
      participants = [],
    } = req.body;

    const currentUserId = req.user._id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    // Ensure creator is in participants and admins
    const membersList = Array.from(new Set([currentUserId.toString(), ...participants]));

    const inviteCode = uuidv4().substring(0, 8);

    const group = new Conversation({
      type: type === "circle" ? "circle" : "group",
      name: name.trim(),
      description: description ? description.trim() : "",
      category,
      avatar,
      participants: membersList,
      admins: [currentUserId],
      inviteCode,
    });

    await group.save();

    const populated = await Conversation.findById(group._id)
      .populate("participants", "fullName username profileImage isOnline")
      .populate("admins", "fullName username profileImage");

    return res.status(201).json({
      success: true,
      message: `${type === "circle" ? "Circle" : "Group"} created successfully`,
      group: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Group / Circle details
 */
export const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Conversation.findOne({
      _id: groupId,
      participants: req.user._id,
    })
      .populate("participants", "fullName username profileImage isOnline bio")
      .populate("admins", "fullName username profileImage");

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found or unauthorized" });
    }

    return res.status(200).json({
      success: true,
      group,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add member to Group
 */
export const addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIds } = req.body;

    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!group.admins.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Only admins can add members" });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: "userIds array is required" });
    }

    await Conversation.findByIdAndUpdate(groupId, {
      $addToSet: { participants: { $each: userIds } },
    });

    return res.status(200).json({
      success: true,
      message: "Members added successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove member from Group
 */
export const removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;

    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!group.admins.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Only admins can remove members" });
    }

    await Conversation.findByIdAndUpdate(groupId, {
      $pull: { participants: memberId, admins: memberId },
    });

    return res.status(200).json({
      success: true,
      message: "Member removed from group",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Leave Group
 */
export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    await Conversation.findByIdAndUpdate(groupId, {
      $pull: { participants: userId, admins: userId },
    });

    return res.status(200).json({
      success: true,
      message: "You have left the group",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Join Group / Circle via Invite Code
 */
export const joinByInviteCode = async (req, res) => {
  try {
    const { code } = req.params;

    const group = await Conversation.findOne({ inviteCode: code });
    if (!group) {
      return res.status(404).json({ success: false, message: "Invalid invite code" });
    }

    if (group.inviteExpiresAt && new Date() > group.inviteExpiresAt) {
      return res.status(400).json({ success: false, message: "This invite link has expired" });
    }

    await Conversation.findByIdAndUpdate(group._id, {
      $addToSet: { participants: req.user._id },
    });

    return res.status(200).json({
      success: true,
      message: `Joined ${group.name}!`,
      groupId: group._id,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Toggle Admin Only Messaging
 */
export const toggleAdminOnlyMessaging = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Conversation.findById(groupId);

    if (!group || !group.admins.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Admin authorization required" });
    }

    group.adminOnlyMessaging = !group.adminOnlyMessaging;
    await group.save();

    return res.status(200).json({
      success: true,
      adminOnlyMessaging: group.adminOnlyMessaging,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
