import Post from "../models/post.model.js";
import Comment from "../models/comment.model.js";
import FriendRequest from "../models/friendRequest.model.js";
import Notification from "../models/notification.model.js";

/**
 * Create a new Post (Permanent Moment)
 */
export const createPost = async (req, res) => {
  try {
    const {
      text = "",
      media = [],
      feeling = "",
      location = "",
      hashtags = [],
      mentions = [],
      poll = null,
      audience = "everyone",
    } = req.body;

    const currentUserId = req.user._id;

    if (!text.trim() && (!media || media.length === 0) && (!poll || !poll.question)) {
      return res.status(400).json({
        success: false,
        message: "A post requires text, media, or a poll",
      });
    }

    // Process hashtags: extract from text if not provided
    let finalHashtags = Array.isArray(hashtags) ? hashtags : [];
    if (text) {
      const extracted = text.match(/#(\w+)/g);
      if (extracted) {
        const cleaned = extracted.map((h) => h.replace("#", "").toLowerCase());
        finalHashtags = [...new Set([...finalHashtags, ...cleaned])];
      }
    }

    const post = new Post({
      user: currentUserId,
      text: text.trim(),
      media: Array.isArray(media) ? media : [],
      feeling: feeling.trim(),
      location: location.trim(),
      hashtags: finalHashtags,
      mentions: Array.isArray(mentions) ? mentions : [],
      poll: poll && poll.question ? poll : undefined,
      audience,
    });

    await post.save();

    const populated = await Post.findById(post._id)
      .populate("user", "fullName username profileImage")
      .populate("mentions", "fullName username profileImage");

    return res.status(201).json({
      success: true,
      message: "Moment shared successfully ✨",
      post: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Moments Feed with filters
 * Supported filters: 'for_you' (default), 'latest', 'friends', 'trending'
 */
export const getPostsFeed = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { filter = "for_you", page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

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

    let query = {};

    if (filter === "friends") {
      query = {
        user: { $in: [currentUserId, ...friendIds] },
      };
    } else {
      // For general feeds, respect private account restrictions
      query = {
        $or: [
          { audience: "everyone" },
          { user: currentUserId },
          { user: { $in: friendIds }, audience: { $in: ["friends", "everyone"] } },
        ],
      };
    }

    let sort = { createdAt: -1 };
    if (filter === "trending") {
      sort = { "reactions.length": -1, commentsCount: -1, createdAt: -1 };
    }

    const posts = await Post.find(query)
      .populate("user", "fullName username profileImage")
      .populate("mentions", "fullName username profileImage")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    return res.status(200).json({
      success: true,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: skip + posts.length < total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * React to Post
 */
export const reactToPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { emoji = "❤️" } = req.body;
    const currentUserId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Moment not found" });
    }

    // Check if user already reacted
    const existingIndex = post.reactions.findIndex(
      (r) => r.user.toString() === currentUserId.toString()
    );

    if (existingIndex > -1) {
      if (post.reactions[existingIndex].emoji === emoji) {
        // Toggle off if same emoji clicked
        post.reactions.splice(existingIndex, 1);
      } else {
        // Update emoji
        post.reactions[existingIndex].emoji = emoji;
      }
    } else {
      post.reactions.push({ user: currentUserId, emoji });

      // Create notification for post owner if not self
      if (post.user.toString() !== currentUserId.toString()) {
        await Notification.create({
          recipient: post.user,
          sender: currentUserId,
          type: "reaction",
          title: "New Reaction",
          message: `${req.user.fullName} reacted ${emoji} to your Moment`,
          targetType: "post",
          targetId: post._id.toString(),
        });
      }
    }

    await post.save();

    return res.status(200).json({
      success: true,
      reactions: post.reactions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Vote on a Poll inside a Post
 */
export const votePoll = async (req, res) => {
  try {
    const { postId, optionId } = req.params;
    const currentUserId = req.user._id;

    const post = await Post.findById(postId);
    if (!post || !post.poll || !post.poll.options) {
      return res.status(404).json({ success: false, message: "Poll not found" });
    }

    // Remove user's previous vote from all options
    post.poll.options.forEach((opt) => {
      opt.votes = opt.votes.filter(
        (v) => v.toString() !== currentUserId.toString()
      );
    });

    // Add vote to chosen option
    const targetOpt = post.poll.options.id(optionId);
    if (targetOpt) {
      targetOpt.votes.push(currentUserId);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      poll: post.poll,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add Comment to a Post
 */
export const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text = "", replyTo = null } = req.body;
    const currentUserId = req.user._id;

    if (!text.trim()) {
      return res.status(400).json({ success: false, message: "Comment text is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Moment not found" });
    }

    const comment = new Comment({
      post: postId,
      user: currentUserId,
      text: text.trim(),
      replyTo,
    });

    await comment.save();

    // Increment comment count
    post.commentsCount = (post.commentsCount || 0) + 1;
    await post.save();

    // Notify post author if not self
    if (post.user.toString() !== currentUserId.toString()) {
      await Notification.create({
        recipient: post.user,
        sender: currentUserId,
        type: "comment",
        title: "New Comment",
        message: `${req.user.fullName} commented: "${text.trim().substring(0, 40)}"`,
        targetType: "post",
        targetId: post._id.toString(),
      });
    }

    const populated = await Comment.findById(comment._id).populate(
      "user",
      "fullName username profileImage"
    );

    return res.status(201).json({
      success: true,
      comment: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Comments for a Post
 */
export const getComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const comments = await Comment.find({ post: postId })
      .populate("user", "fullName username profileImage")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      comments,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Save or Unsave Post to Collections
 */
export const toggleSavePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Moment not found" });
    }

    const isSaved = post.savedBy.some(
      (id) => id.toString() === currentUserId.toString()
    );

    if (isSaved) {
      post.savedBy = post.savedBy.filter(
        (id) => id.toString() !== currentUserId.toString()
      );
    } else {
      post.savedBy.push(currentUserId);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      isSaved: !isSaved,
      message: !isSaved ? "Saved to collections" : "Removed from collections",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Edit Own Post
 */
export const editPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text, feeling, location, audience } = req.body;
    const currentUserId = req.user._id;

    const post = await Post.findOne({ _id: postId, user: currentUserId });
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found or unauthorized" });
    }

    if (text !== undefined) post.text = text.trim();
    if (feeling !== undefined) post.feeling = feeling.trim();
    if (location !== undefined) post.location = location.trim();
    if (audience !== undefined) post.audience = audience;

    await post.save();

    return res.status(200).json({
      success: true,
      message: "Moment updated successfully",
      post,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete Own Post
 */
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.user._id;

    const post = await Post.findOneAndDelete({ _id: postId, user: currentUserId });
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found or unauthorized" });
    }

    // Clean up comments
    await Comment.deleteMany({ post: postId });

    return res.status(200).json({
      success: true,
      message: "Moment deleted",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
