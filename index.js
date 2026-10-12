
import "dotenv/config";

import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

const app = express();

// ================= MIDDLEWARE =================

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  : [];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without Origin (Postman, server-to-server).
      // When FRONTEND_URL is unset, allow all origins for local development.
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
  const dbConnected = mongooseConnectionReady();

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    server: "online",
    database: dbConnected ? "connected" : "disconnected",
  });
});

function mongooseConnectionReady() {
  // readyState 1 means Mongoose is connected.
  return Boolean(
    globalThis.__deepEduMongooseConnected
  );
}


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ================= ERROR HANDLER =================

app.use((err, req, res, next) => {
  console.error("API Error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? statusCode === 500
          ? "Internal server error"
          : err.message
        : err.message,
  });
});

// ================= START SERVER =================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Mark DB as connected for the health endpoint.
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
