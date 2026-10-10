import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";

/**
 * Get or create 1-to-1 conversation with another user
 */
export const getOrCreateDirectChat = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const currentUserId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: "recipientId is required" });
    }

    if (recipientId.toString() === currentUserId.toString()) {
      return res.status(400).json({ success: false, message: "Cannot create chat with self" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient user not found" });
    }

    // Check if blocked
    if (recipient.blockedUsers?.includes(currentUserId) || req.user.blockedUsers?.includes(recipientId)) {
      return res.status(403).json({ success: false, message: "Cannot message this user due to privacy/block settings" });
    }

    // Find existing direct conversation
    let conversation = await Conversation.findOne({
      type: "direct",
      participants: { $all: [currentUserId, recipientId] },
    }).populate("participants", "fullName username profileImage isOnline lastSeen privacySettings");

    if (!conversation) {
      conversation = new Conversation({
        type: "direct",
        participants: [currentUserId, recipientId],
        admins: [currentUserId, recipientId],
      });
      await conversation.save();

      conversation = await Conversation.findById(conversation._id).populate(
        "participants",
        "fullName username profileImage isOnline lastSeen privacySettings"
      );
    }

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * List all conversations of current user
 */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "fullName username profileImage isOnline lastSeen privacySettings")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });

    // Calculate unread counts for each conversation
    const formatted = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
          deletedFor: { $ne: userId },
        });

        // Determine title & avatar for 1-on-1 vs group
        let title = conv.name;
        let avatar = conv.avatar;
        let otherUser = null;

        if (conv.type === "direct") {
          const other = conv.participants.find(
            (p) => p._id.toString() !== userId.toString()
          );
          if (other) {
            title = other.fullName;
            avatar = other.profileImage;
            otherUser = {
              _id: other._id,
              fullName: other.fullName,
              username: other.username,
              profileImage: other.profileImage,
              isOnline:
                !other.privacySettings?.ghostMode &&
                other.privacySettings?.showOnline !== false
                  ? other.isOnline
                  : false,
              lastSeen:
                !other.privacySettings?.ghostMode &&
                other.privacySettings?.showLastSeen !== false
                  ? other.lastSeen
                  : null,
            };
          }
        }

        return {
          _id: conv._id,
          type: conv.type,
          title,
          avatar,
          category: conv.category,
          otherUser,
          lastMessageText: conv.lastMessageText || (conv.lastMessage?.text ?? ""),
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
          isPinned: conv.pinnedBy?.includes(userId),
          isArchived: conv.archivedBy?.includes(userId),
          isMuted: conv.mutedBy?.includes(userId),
          participantsCount: conv.participants?.length || 0,
        };
      })
    );

    return res.status(200).json({
      success: true,
      conversations: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get messages of a conversation (paginated)
 */
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view messages in this conversation",
      });
    }

    const messages = await Message.find({
      conversation: conversationId,
      deletedFor: { $ne: userId },
    })
      .populate("replyTo", "text senderName messageType")
      .populate("reactions.user", "fullName username profileImage")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId, deliveredTo: userId },
        $set: { status: "seen" },
      }
    );

    return res.status(200).json({
      success: true,
      messages: messages.reverse(), // chronologically ordered
      page: Number(page),
      hasMore: messages.length === Number(limit),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send a message
 */
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text, messageType = "text", attachments = [], replyTo, expiresAt } = req.body;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant of this conversation",
      });
    }

    if (conversation.adminOnlyMessaging && !conversation.admins.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only group admins can send messages in this conversation",
      });
    }

    const message = new Message({
      conversation: conversationId,
      sender: userId,
      senderName: req.user.fullName,
      senderAvatar: req.user.profileImage,
      text: text ? text.trim() : "",
      messageType,
      attachments: Array.isArray(attachments) ? attachments : [],
      replyTo: replyTo || null,
      status: "sent",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    await message.save();

    // Update conversation last message
    conversation.lastMessage = message._id;
    conversation.lastMessageText = text ? text.trim() : `[${messageType}]`;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    const populated = await Message.findById(message._id)
      .populate("replyTo", "text senderName messageType")
      .populate("sender", "fullName username profileImage");

    // Emit socket event to conversation room
    const io = req.app.get("io");
    if (io) {
      io.to(conversationId.toString()).emit("newMessage", populated);
    }

    return res.status(201).json({
      success: true,
      message: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Edit own message
 */
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message content cannot be empty" });
    }

    if (text.trim().length > 5000) {
      return res.status(400).json({ success: false, message: "Message cannot exceed 5000 characters" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized: You can only edit your own messages" });
    }

    // Verify conversation membership
    const conversation = await Conversation.findOne({
      _id: message.conversation,
      participants: userId,
    });
    if (!conversation) {
      return res.status(403).json({ success: false, message: "You are not an active member of this conversation" });
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({ success: false, message: "Cannot edit a deleted message" });
    }

    message.text = text.trim();
    message.isEdited = true;
    await message.save();

    // If message was conversation lastMessage, update preview
    if (conversation.lastMessage && conversation.lastMessage.toString() === message._id.toString()) {
      conversation.lastMessageText = message.text;
      await conversation.save();
    }

    const populated = await Message.findById(message._id)
      .populate("replyTo", "text senderName messageType")
      .populate("sender", "fullName username profileImage")
      .populate("reactions.user", "fullName username profileImage");

    const io = req.app.get("io");
    if (io) {
      io.to(message.conversation.toString()).emit("messageUpdated", populated);
    }

    return res.status(200).json({
      success: true,
      message: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete message (for me OR for everyone)
 */
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { forEveryone = false } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Verify conversation membership
    const conversation = await Conversation.findOne({
      _id: message.conversation,
      participants: userId,
    });
    const isAdmin = req.user.role === "admin" || req.user.role === "super_admin";

    if (!conversation && !isAdmin) {
      return res.status(403).json({ success: false, message: "Unauthorized to access this conversation" });
    }

    if (forEveryone) {
      const isOwner = message.sender.toString() === userId.toString();
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: "Only message sender or admin can delete for everyone" });
      }

      message.isDeletedForEveryone = true;
      message.text = "This message was deleted";
      message.attachments = [];
      await message.save();

      // If conversation last message
      if (conversation && conversation.lastMessage?.toString() === message._id.toString()) {
        conversation.lastMessageText = "This message was deleted";
        await conversation.save();
      }

      if (isAdmin && !isOwner) {
        await AuditLog.create({
          admin: req.user._id,
          action: "MODERATE_DELETE_MESSAGE",
          targetType: "Message",
          targetId: messageId,
          details: { conversationId: message.conversation.toString() },
          ipAddress: req.ip || "",
        });
      }

      const io = req.app.get("io");
      if (io) {
        io.to(message.conversation.toString()).emit("messageDeleted", {
          messageId,
          conversationId: message.conversation,
          forEveryone: true,
        });
      }
    } else {
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: userId },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
      forEveryone: Boolean(forEveryone),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * React to a message with Emoji
 */
export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Remove existing reaction by same user
    message.reactions = message.reactions.filter(
      (r) => r.user.toString() !== userId.toString()
    );

    // If new emoji provided, add it
    if (emoji) {
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();

    const populated = await Message.findById(messageId).populate(
      "reactions.user",
      "fullName username profileImage"
    );

    const io = req.app.get("io");
    if (io) {
      io.to(message.conversation.toString()).emit("reactionUpdated", {
        messageId,
        reactions: populated.reactions,
      });
    }

    return res.status(200).json({
      success: true,
      reactions: populated.reactions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Pin or Unpin a message in conversation
 */
export const togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    message.pinned = !message.pinned;
    await message.save();

    const io = req.app.get("io");
    if (io) {
      io.to(message.conversation.toString()).emit("messagePinned", {
        messageId,
        pinned: message.pinned,
        conversationId: message.conversation,
      });
    }

    return res.status(200).json({
      success: true,
      pinned: message.pinned,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Star or Unstar a message for user
 */
export const toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const isStarred = message.starredBy?.includes(userId);
    if (isStarred) {
      message.starredBy = message.starredBy.filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      message.starredBy.push(userId);
    }

    await message.save();

    return res.status(200).json({
      success: true,
      isStarred: !isStarred,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get conversation details, other participant, and shared media
 */
export const getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    })
      .populate("participants", "fullName username displayName profileImage bio isOnline lastSeen privacySettings")
      .populate("admins", "fullName username displayName profileImage");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or unauthorized",
      });
    }

    let otherUser = null;
    let title = conversation.name;
    let avatar = conversation.avatar;

    if (conversation.type === "direct") {
      const other = conversation.participants.find(
        (p) => p._id.toString() !== userId.toString()
      );
      if (other) {
        title = other.displayName || other.fullName;
        avatar = other.profileImage;
        const canShowOnline =
          !other.privacySettings?.ghostMode &&
          other.privacySettings?.showOnline !== false;
        const canShowLastSeen =
          !other.privacySettings?.ghostMode &&
          other.privacySettings?.showLastSeen !== false;
        otherUser = {
          _id: other._id,
          fullName: other.fullName,
          displayName: other.displayName || other.fullName,
          username: other.username,
          profileImage: other.profileImage,
          bio: other.bio,
          isOnline: canShowOnline ? Boolean(other.isOnline) : false,
          lastSeen: canShowLastSeen ? other.lastSeen : null,
        };
      }
    }

    // Fetch shared media in this conversation
    const sharedMedia = await Message.find({
      conversation: conversationId,
      deletedFor: { $ne: userId },
      isDeletedForEveryone: false,
      "attachments.0": { $exists: true },
    })
      .select("attachments createdAt senderName")
      .sort({ createdAt: -1 })
      .limit(30);

    return res.status(200).json({
      success: true,
      conversation: {
        _id: conversation._id,
        type: conversation.type,
        name: title,
        avatar,
        description: conversation.description,
        category: conversation.category,
        otherUser,
        participants: conversation.participants,
        admins: conversation.admins,
        isPinned: conversation.pinnedBy?.includes(userId),
        isMuted: conversation.mutedBy?.includes(userId),
        isArchived: conversation.archivedBy?.includes(userId),
        sharedMedia,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Clear conversation history for current user (Delete for Me on all)
 */
export const clearChat = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    await Message.updateMany(
      { conversation: conversationId },
      { $addToSet: { deletedFor: userId } }
    );

    return res.status(200).json({
      success: true,
      message: "Chat cleared successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Forward message to another conversation
 */
export const forwardMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { targetConversationId } = req.body;
    const userId = req.user._id;

    if (!targetConversationId) {
      return res.status(400).json({ success: false, message: "targetConversationId is required" });
    }

    const original = await Message.findById(messageId);
    if (!original || original.isDeletedForEveryone) {
      return res.status(404).json({ success: false, message: "Message not found or deleted" });
    }

    const targetConv = await Conversation.findOne({
      _id: targetConversationId,
      participants: userId,
    });
    if (!targetConv) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of the target conversation",
      });
    }

    const forwarded = new Message({
      conversation: targetConversationId,
      sender: userId,
      senderName: req.user.fullName,
      senderAvatar: req.user.profileImage,
      text: original.text,
      messageType: original.messageType,
      attachments: original.attachments,
      status: "sent",
    });

    await forwarded.save();

    targetConv.lastMessage = forwarded._id;
    targetConv.lastMessageText = original.text || `[Forwarded ${original.messageType}]`;
    targetConv.lastMessageAt = forwarded.createdAt;
    await targetConv.save();

    const populated = await Message.findById(forwarded._id).populate("sender", "fullName username profileImage");

    const io = req.app.get("io");
    if (io) {
      io.to(targetConversationId.toString()).emit("newMessage", populated);
    }

    return res.status(201).json({
      success: true,
      message: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Acknowledge message delivery
 */
export const markDelivered = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { messageIds } = req.body;
    const userId = req.user._id;

    if (Array.isArray(messageIds) && messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds }, status: "sent", sender: { $ne: userId } },
        {
          $addToSet: { deliveredTo: userId },
          $set: { status: "delivered" },
        }
      );

      const io = req.app.get("io");
      if (io) {
        io.to(conversationId.toString()).emit("messageDeliveredUpdate", {
          conversationId,
          messageIds,
          userId,
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
