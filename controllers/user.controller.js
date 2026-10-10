import User from "../models/user.model.js";

/**
 * Search users by Raaz ID (@username) or name
 * Mobile numbers are strictly hidden from public search for privacy!
 */
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(200).json({ success: true, users: [] });
    }

    const cleanQuery = query.trim().replace(/^@+/, "");

    // Search username or fullName, excluding current user
    const users = await User.find({
      _id: { $ne: req.user._id },
      isBanned: false,
      $or: [
        { username: { $regex: cleanQuery, $options: "i" } },
        { fullName: { $regex: cleanQuery, $options: "i" } },
      ],
    })
      .select("fullName username profileImage bio isOnline lastSeen privacySettings")
      .limit(20);

    // Apply Ghost Mode / privacy rules
    const formatted = users.map((u) => {
      const showOnline =
        !u.privacySettings?.ghostMode && u.privacySettings?.showOnline !== false;
      const showLastSeen =
        !u.privacySettings?.ghostMode && u.privacySettings?.showLastSeen !== false;

      return {
        _id: u._id,
        fullName: u.fullName,
        username: u.username,
        profileImage: u.profileImage,
        bio: u.bio,
        isOnline: showOnline ? u.isOnline : false,
        lastSeen: showLastSeen ? u.lastSeen : null,
      };
    });

    return res.status(200).json({
      success: true,
      users: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get public profile of a user by username or ID
 */
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = id.replace(/^@+/, "").toLowerCase();

    let user;
    if (cleanId.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(cleanId);
    } else {
      user = await User.findOne({ username: cleanId });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isSelf = req.user && req.user._id.toString() === user._id.toString();
    const isBlocked = user.blockedUsers?.includes(req.user?._id);

    if (isBlocked && !isSelf) {
      return res.status(403).json({ success: false, message: "Profile unavailable" });
    }

    const showOnline =
      isSelf ||
      (!user.privacySettings?.ghostMode && user.privacySettings?.showOnline !== false);
    const showLastSeen =
      isSelf ||
      (!user.privacySettings?.ghostMode && user.privacySettings?.showLastSeen !== false);
    const showPhone = isSelf || user.privacySettings?.showPhone === true;

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        profileImage: user.profileImage,
        bio: user.bio,
        phone: showPhone ? user.phone : undefined,
        email: isSelf ? user.email : undefined,
        isOnline: showOnline ? user.isOnline : false,
        lastSeen: showLastSeen ? user.lastSeen : null,
        currentMood: user.currentMood?.isPrivate && !isSelf ? null : user.currentMood,
        privacySettings: isSelf ? user.privacySettings : undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update authenticated user profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { fullName, bio, profileImage, gender, address, city, state } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (fullName) user.fullName = fullName.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (gender) user.gender = gender;
    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;
    if (state !== undefined) user.state = state;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: user.toObject(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Ghost Mode & Privacy Settings
 */
export const updatePrivacySettings = async (req, res) => {
  try {
    const {
      ghostMode,
      showOnline,
      showLastSeen,
      showReadReceipts,
      showTyping,
      showPhone,
      quietHours,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (ghostMode !== undefined) user.privacySettings.ghostMode = ghostMode;
    if (showOnline !== undefined) user.privacySettings.showOnline = showOnline;
    if (showLastSeen !== undefined) user.privacySettings.showLastSeen = showLastSeen;
    if (showReadReceipts !== undefined)
      user.privacySettings.showReadReceipts = showReadReceipts;
    if (showTyping !== undefined) user.privacySettings.showTyping = showTyping;
    if (showPhone !== undefined) user.privacySettings.showPhone = showPhone;
    if (quietHours !== undefined) user.privacySettings.quietHours = quietHours;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Privacy settings updated",
      privacySettings: user.privacySettings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Feelings Mode: Set or clear mood
 */
export const updateMood = async (req, res) => {
  try {
    const { mood, note, isPrivate, durationHours = 24 } = req.body;

    const user = await User.findById(req.user._id);

    if (!mood) {
      user.currentMood = {
        mood: "",
        note: "",
        updatedAt: null,
        expiresAt: null,
        isPrivate: false,
      };
    } else {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
      user.currentMood = {
        mood,
        note: note || "",
        updatedAt: now,
        expiresAt,
        isPrivate: Boolean(isPrivate),
      };
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: mood ? "Mood shared successfully" : "Mood removed",
      currentMood: user.currentMood,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Block a user
 */
export const blockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "targetUserId is required" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: targetUserId },
    });

    return res.status(200).json({
      success: true,
      message: "User blocked successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Unblock a user
 */
export const unblockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: targetUserId },
    });

    return res.status(200).json({
      success: true,
      message: "User unblocked successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Register FCM Device Token for push notifications
 */
export const registerDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { deviceTokens: token },
      deviceToken: token,
    });

    return res.status(200).json({
      success: true,
      message: "Device token registered successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
