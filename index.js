import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";

import connectDB from "./config/db.js";
import User from "./models/user.model.js";
import Message from "./models/message.model.js";
import { startCapsuleScheduler } from "./services/scheduler.service.js";

// Import Routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import friendRoutes from "./routes/friend.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import groupRoutes from "./routes/group.routes.js";
import secretRoomRoutes from "./routes/secretRoom.routes.js";
import momentRoutes from "./routes/moment.routes.js";
import timeCapsuleRoutes from "./routes/timeCapsule.routes.js";
import chatPlayRoutes from "./routes/chatPlay.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import reportRoutes from "./routes/report.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import cardRoutes from "./routes/cardRoutes.js"; // Legacy preservation

const app = express();

// ================= SERVER =================
const server = createServer(app);

// ================= SOCKET.IO =================
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
  transports: ["websocket", "polling"],
});

app.set("io", io);

// ================= MIDDLEWARE =================
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ensure uploads folder exists
const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static files for uploaded media
app.use("/uploads", express.static(uploadsDir));

// Admin Dashboard Frontend
app.use("/admin", express.static(path.resolve("public/admin")));

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/secret-room", secretRoomRoutes);
app.use("/api/moments", momentRoutes);
app.use("/api/capsules", timeCapsuleRoutes);
app.use("/api/chat-play", chatPlayRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/cards", cardRoutes); // Legacy

// Health Check
app.get("/", (req, res) => {
  res.json({
    success: true,
    platform: "RaazChat Pro API",
    tagline: "Your Space. Your People. Your Rules.",
    version: "1.0.0",
    theme: {
      primary: "#FF7A00",
      secondary: "#F59E0B",
      background: "#FFF9F2",
    },
    status: "Active & Real-Time Ready 🚀",
  });
});

// Map of socket.id -> userId
const onlineUsers = new Map();

// ================= SOCKET EVENTS =================
io.on("connection", (socket) => {
  console.log("🔥 [Socket] Connected:", socket.id);

  // Authenticate user socket & update presence
  socket.on("userOnline", async (userId) => {
    if (!userId) return;
    socket.userId = userId;
    onlineUsers.set(userId.toString(), socket.id);

    try {
      const user = await User.findById(userId);
      if (user) {
        user.isOnline = true;
        user.socketId = socket.id;
        await user.save();

        // Broadcast presence if Ghost Mode is disabled
        const ghostMode =
          user.privacySettings?.ghostMode ||
          user.privacySettings?.showOnline === false;

        if (!ghostMode) {
          io.emit("userPresenceChanged", {
            userId: user._id,
            isOnline: true,
            lastSeen: user.lastSeen,
          });
        }
      }
    } catch (err) {
      console.error("[Socket] userOnline error:", err);
    }
  });

  // Join a conversation room (direct, group, circle, secret room)
  socket.on("joinRoom", (roomId) => {
    if (roomId) {
      socket.join(roomId.toString());
      console.log(`[Socket] ${socket.id} joined room: ${roomId}`);
    }
  });

  // Leave room
  socket.on("leaveRoom", (roomId) => {
    if (roomId) {
      socket.leave(roomId.toString());
    }
  });

  // Typing indicators
  socket.on("typing", ({ conversationId, user }) => {
    socket.to(conversationId.toString()).emit("userTyping", {
      conversationId,
      user,
    });
  });

  socket.on("stopTyping", ({ conversationId, userId }) => {
    socket.to(conversationId.toString()).emit("userStoppedTyping", {
      conversationId,
      userId,
    });
  });

  // Message read receipts
  socket.on("markSeen", async ({ conversationId, messageId, userId }) => {
    try {
      if (messageId && userId) {
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: { readBy: userId, deliveredTo: userId },
          status: "seen",
        });

        socket.to(conversationId.toString()).emit("messageSeenUpdate", {
          conversationId,
          messageId,
          userId,
        });
      }
    } catch (err) {
      console.error("[Socket] markSeen error:", err);
    }
  });

  // Disconnection handler
  socket.on("disconnect", async () => {
    console.log("❌ [Socket] Disconnected:", socket.id);

    if (socket.userId) {
      onlineUsers.delete(socket.userId.toString());
      try {
        const user = await User.findById(socket.userId);
        if (user) {
          user.isOnline = false;
          user.lastSeen = new Date();
          user.socketId = "";
          await user.save();

          const ghostMode =
            user.privacySettings?.ghostMode ||
            user.privacySettings?.showOnline === false;

          if (!ghostMode) {
            io.emit("userPresenceChanged", {
              userId: user._id,
              isOnline: false,
              lastSeen: user.lastSeen,
            });
          }
        }
      } catch (err) {
        console.error("[Socket] disconnect error:", err);
      }
    }
  });
});

// ================= DATABASE & START SERVER =================
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  // Start Time Capsule background scheduler
  startCapsuleScheduler();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 RaazChat Pro Backend Running on http://localhost:${PORT}`);
  });
});