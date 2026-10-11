import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

const app = express();

// ================= MIDDLEWARE =================

app.use(
  cors({
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
      : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ================= HEALTH CHECK =================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DeepEdu Backend is running",
    status: "healthy",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    server: "online",
    database: "check server logs for connection status",
  });
});

// ================= API ROUTES =================
// Apne existing routes ke imports aur app.use() yahan rakhein.
// Example:
// import authRoutes from "./routes/authRoutes.js";
// app.use("/api/auth", authRoutes);

// ================= 404 HANDLER =================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ================= ERROR HANDLER =================

app.use((err, req, res, next) => {
  console.error("API Error:", err.message);

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// ================= START SERVER =================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log("Connecting to MongoDB...");

    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`DeepEdu Backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  }
};

startServer();