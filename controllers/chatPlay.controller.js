import ChatPlay from "../models/chatPlay.model.js";
import Conversation from "../models/conversation.model.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new ChatPlay activity inside a conversation
 */
export const createActivity = async (req, res) => {
  try {
    const {
      conversationId,
      activityType = "poll",
      title,
      question,
      options = [],
      metadata = {},
    } = req.body;

    const currentUserId = req.user._id;

    if (!conversationId || !title) {
      return res.status(400).json({
        success: false,
        message: "conversationId and title are required",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to launch activity in this conversation",
      });
    }

    const formattedOptions = options.map((opt) => ({
      id: opt.id || uuidv4().substring(0, 8),
      text: typeof opt === "string" ? opt : opt.text,
      votes: [],
    }));

    const activity = new ChatPlay({
      conversation: conversationId,
      creator: currentUserId,
      activityType,
      title: title.trim(),
      question: question ? question.trim() : "",
      options: formattedOptions,
      metadata,
    });

    await activity.save();

    const io = req.app.get("io");
    if (io) {
      io.to(conversationId.toString()).emit("chatPlayActivityCreated", activity);
    }

    return res.status(201).json({
      success: true,
      message: "ChatPlay activity launched!",
      activity,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Vote in a poll or respond to an activity
 */
export const voteActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const { optionId } = req.body;
    const currentUserId = req.user._id;

    const activity = await ChatPlay.findById(activityId);
    if (!activity) {
      return res.status(404).json({ success: false, message: "Activity not found" });
    }

    // Remove user's previous votes
    activity.options.forEach((opt) => {
      opt.votes = opt.votes.filter(
        (v) => v.toString() !== currentUserId.toString()
      );
    });

    // Add vote to chosen option
    const targetOption = activity.options.find((opt) => opt.id === optionId);
    if (targetOption) {
      targetOption.votes.push(currentUserId);
    }

    await activity.save();

    const io = req.app.get("io");
    if (io) {
      io.to(activity.conversation.toString()).emit("chatPlayVoteUpdated", activity);
    }

    return res.status(200).json({
      success: true,
      activity,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get active activities for a conversation
 */
export const getConversationActivities = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const activities = await ChatPlay.find({
      conversation: conversationId,
      isActive: true,
    })
      .populate("creator", "fullName username profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      activities,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
