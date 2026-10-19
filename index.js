import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import superadminRoutes from "./routes/superadmin.routes.js";
import academicRoutes from "./routes/academic.routes.js";
import studentRoutes from "./routes/student.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import homeworkRoutes from "./routes/homework.routes.js";
import examRoutes from "./routes/exam.routes.js";
import feeRoutes from "./routes/fee.routes.js";
import complaintRoutes from "./routes/complaint.routes.js";
import noticeRoutes from "./routes/notice.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import reportRoutes from "./routes/report.routes.js";

const app = express();

// ================= SECURITY & MIDDLEWARE =================

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  : [];

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ================= HEALTH CHECK =================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DeepEdu Backend is running",
    status: "healthy",
  });
});

app.get("/health", (req, res) => {
  const dbConnected = mongooseConnectionReady();

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    server: "online",
    database: dbConnected ? "connected" : "disconnected",
  });
});

function mongooseConnectionReady() {
  return Boolean(globalThis.__deepEduMongooseConnected);
}

// ================= API ROUTES =================

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/academics", academicRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);

// ================= 404 NOT FOUND HANDLER =================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ================= ERROR HANDLER =================

app.use((err, req, res, next) => {
  console.error("API Error Stack:", err.stack || err.message);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

// ================= START SERVER =================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    globalThis.__deepEduMongooseConnected = true;

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`DeepEdu Backend running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });

    server.on("error", (error) => {
      console.error("HTTP server error:", error.message);
      process.exitCode = 1;
    });
  } catch (error) {
    globalThis.__deepEduMongooseConnected = false;
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
export default app;
