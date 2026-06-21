import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

import connectDB from "./config/db.js";

// ROUTES
import cardRoutes from "./routes/cardRoutes.js";

const app = express();

// ================= SERVER =================
const server = createServer(app);

// ================= SOCKET =================
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= STATIC FILES =================
app.use("/uploads", express.static(path.join("uploads")));

// ================= ROUTES =================

// Card CRUD Routes
app.use("/api/cards", cardRoutes);

// Health Check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Star News API Running 🚀",
  });
});

// ================= SOCKET EVENTS =================
io.on("connection", (socket) => {
  console.log("🔥 User connected:", socket.id);

  socket.on("joinNews", (newsId) => {
    socket.join(newsId);
  });

  socket.on("joinRoom", (newsId) => {
    socket.join(newsId);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// ================= DATABASE =================
connectDB();

// ================= START SERVER =================
const PORT = process.env.PORT || 5002;

app.listen(5000, "0.0.0.0", () => {
  console.log("Server Running On Port 5000");
});