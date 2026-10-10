import SecretRoom from "../models/secretRoom.model.js";
import Conversation from "../models/conversation.model.js";
import crypto from "crypto";

/**
 * Create a temporary Secret Room
 */
export const createSecretRoom = async (req, res) => {
  try {
    const {
      title = "Secret Room",
      durationMinutes = 60,
      messageExpirySeconds = 300,
    } = req.body;

    const currentUserId = req.user._id;

    // Generate cryptographic invitation code (e.g. 6-digit alphanumeric)
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Create underlying conversation for room messages
    const conversation = new Conversation({
      type: "group",
      name: `🔒 ${title}`,
      description: "Temporary private secret room",
      participants: [currentUserId],
      admins: [currentUserId],
    });
    await conversation.save();

    const room = new SecretRoom({
      title,
      code,
      creator: currentUserId,
      members: [currentUserId],
      conversation: conversation._id,
      messageExpirySeconds,
      expiresAt,
    });
    await room.save();

    return res.status(201).json({
      success: true,
      message: "Secret Room created securely",
      room: {
        _id: room._id,
        title: room.title,
        code: room.code,
        conversationId: conversation._id,
        expiresAt: room.expiresAt,
        messageExpirySeconds: room.messageExpirySeconds,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Join Secret Room via Code
 */
export const joinSecretRoom = async (req, res) => {
  try {
    const { code } = req.body;
    const currentUserId = req.user._id;

    if (!code) {
      return res.status(400).json({ success: false, message: "Invitation code required" });
    }

    const cleanCode = code.trim().toUpperCase();
    const room = await SecretRoom.findOne({
      code: cleanCode,
      isActive: true,
    });

    if (!room) {
      return res.status(404).json({ success: false, message: "Secret room not found or closed" });
    }

    if (new Date() > room.expiresAt) {
      room.isActive = false;
      await room.save();
      return res.status(410).json({ success: false, message: "This secret room has expired" });
    }

    if (room.revokedInvite) {
      return res.status(403).json({ success: false, message: "Invitation for this room has been revoked" });
    }

    // Add user to room and conversation
    await SecretRoom.findByIdAndUpdate(room._id, {
      $addToSet: { members: currentUserId },
    });

    await Conversation.findByIdAndUpdate(room.conversation, {
      $addToSet: { participants: currentUserId },
    });

    return res.status(200).json({
      success: true,
      message: `Joined secret room "${room.title}"!`,
      room: {
        _id: room._id,
        title: room.title,
        conversationId: room.conversation,
        expiresAt: room.expiresAt,
        messageExpirySeconds: room.messageExpirySeconds,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Close / End Secret Room
 */
export const closeSecretRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUserId = req.user._id;

    const room = await SecretRoom.findOne({
      _id: roomId,
      creator: currentUserId,
    });

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found or unauthorized" });
    }

    room.isActive = false;
    await room.save();

    return res.status(200).json({
      success: true,
      message: "Secret room closed and locked",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
