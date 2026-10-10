import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";

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

    const message = await Message.findOne({ _id: messageId, sender: userId });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found or unauthorized" });
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({ success: false, message: "Cannot edit a deleted message" });
    }

    message.text = text.trim();
    message.isEdited = true;
    await message.save();

    const io = req.app.get("io");
    if (io) {
      io.to(message.conversation.toString()).emit("messageUpdated", message);
    }

    return res.status(200).json({
      success: true,
      message,
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

    if (forEveryone) {
      if (message.sender.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: "Can only delete own messages for everyone" });
      }
      message.isDeletedForEveryone = true;
      message.text = "This message was deleted";
      message.attachments = [];
      await message.save();

      const io = req.app.get("io");
      if (io) {
        io.to(message.conversation.toString()).emit("messageDeleted", {
          messageId,
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
