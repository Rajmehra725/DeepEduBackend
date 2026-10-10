import MoodEntry from "../models/mood.model.js";
import User from "../models/user.model.js";

/**
 * Record today's mood (Daily Pulse & Journal Entry)
 * Mood information is strictly private by default.
 */
export const recordMood = async (req, res) => {
  try {
    const { mood, note = "", isPrivate = true, sharedWith = [] } = req.body;
    const currentUserId = req.user._id;

    if (!mood) {
      return res.status(400).json({ success: false, message: "Mood is required" });
    }

    const validMoods = [
      "happy",
      "loved",
      "chill",
      "sad",
      "excited",
      "grateful",
      "thoughtful",
      "tired",
    ];

    if (!validMoods.includes(mood.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid mood. Supported moods: ${validMoods.join(", ")}`,
      });
    }

    const cleanMood = mood.toLowerCase();

    // Create journal entry
    const entry = new MoodEntry({
      user: currentUserId,
      mood: cleanMood,
      note: note.trim(),
      isPrivate: Boolean(isPrivate),
      sharedWith: Array.isArray(sharedWith) ? sharedWith : [],
      date: new Date(),
    });

    await entry.save();

    // Update user's current active mood badge on profile
    await User.findByIdAndUpdate(currentUserId, {
      "currentMood.mood": cleanMood,
      "currentMood.note": note.trim(),
      "currentMood.updatedAt": new Date(),
      "currentMood.isPrivate": Boolean(isPrivate),
    });

    return res.status(201).json({
      success: true,
      message: "Mood recorded in your private journal ✨",
      entry,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get User's Private Mood Journal History & Stats
 * Only the owner can view their own private journal entries.
 */
export const getMoodHistory = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { limit = 30 } = req.query;

    const history = await MoodEntry.find({ user: currentUserId })
      .sort({ date: -1 })
      .limit(parseInt(limit));

    // Calculate personal mood stats
    const stats = {};
    history.forEach((h) => {
      stats[h.mood] = (stats[h.mood] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      history,
      stats,
      totalEntries: history.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update an existing Mood Journal Entry
 */
export const updateMoodEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    const { mood, note, isPrivate } = req.body;
    const currentUserId = req.user._id;

    const entry = await MoodEntry.findOne({ _id: entryId, user: currentUserId });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    if (mood) entry.mood = mood.toLowerCase();
    if (note !== undefined) entry.note = note.trim();
    if (isPrivate !== undefined) entry.isPrivate = Boolean(isPrivate);

    await entry.save();

    return res.status(200).json({
      success: true,
      message: "Mood journal entry updated",
      entry,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a Mood Journal Entry
 */
export const deleteMoodEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    const currentUserId = req.user._id;

    const entry = await MoodEntry.findOneAndDelete({ _id: entryId, user: currentUserId });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Journal entry removed",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
