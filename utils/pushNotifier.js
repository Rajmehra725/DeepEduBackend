import axios from "axios";
import User from "../models/User.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Dispatch Push Notification to specific recipient User IDs via Expo Push Service.
 * Deduplicates tokens, validates format, logs tickets, and cleans up unregistered device tokens.
 */
export const sendPushToUsers = async (userIds, { title, body, data = {}, categoryId = "default" }) => {
  try {
    if (!userIds || (Array.isArray(userIds) && userIds.length === 0)) return;

    const ids = Array.isArray(userIds) ? userIds : [userIds];

    // Query active device tokens for the recipient users
    const users = await User.find({
      _id: { $in: ids },
      "deviceTokens.0": { $exists: true },
    }).select("_id deviceTokens");

    const tokensWithUser = [];
    users.forEach((u) => {
      (u.deviceTokens || []).forEach((d) => {
        if (d.token) {
          tokensWithUser.push({ userId: u._id, token: d.token });
        }
      });
    });

    if (tokensWithUser.length === 0) {
      return { sent: 0, reason: "No registered device tokens for recipients" };
    }

    // Deduplicate tokens
    const uniqueMap = new Map();
    tokensWithUser.forEach((item) => {
      uniqueMap.set(item.token, item.userId);
    });

    const messages = [];
    uniqueMap.forEach((uId, token) => {
      messages.push({
        to: token,
        sound: "default",
        title: title || "DeepEdu Notification",
        body: body || "",
        data: { ...data, userId: uId.toString() },
        priority: "high",
        channelId: "default",
        categoryId,
      });
    });

    // Chunk into batches of 100 as recommended by Expo
    const chunkSize = 100;
    const deadTokens = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      try {
        const response = await axios.post(EXPO_PUSH_URL, chunk, {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          timeout: 10000,
        });

        const tickets = response.data?.data || [];
        tickets.forEach((ticket, idx) => {
          if (ticket.status === "error") {
            console.warn(`Expo push error for token ${chunk[idx].to}:`, ticket.message, ticket.details);
            if (ticket.details?.error === "DeviceNotRegistered") {
              deadTokens.push(chunk[idx].to);
            }
          }
        });
      } catch (chunkErr) {
        console.error("Expo push network dispatch error:", chunkErr.message);
      }
    }

    // Safely remove expired / uninstalled tokens from database
    if (deadTokens.length > 0) {
      await User.updateMany(
        { "deviceTokens.token": { $in: deadTokens } },
        { $pull: { deviceTokens: { token: { $in: deadTokens } } } }
      );
    }

    return { sent: messages.length, deadTokensCleaned: deadTokens.length };
  } catch (error) {
    console.error("sendPushToUsers unexpected failure:", error);
    return { sent: 0, error: error.message };
  }
};
