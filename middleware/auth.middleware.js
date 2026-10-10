import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token required",
      });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "raazchat_super_secret_jwt_key_2026";
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account no longer exists",
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `Account is banned: ${user.banReason || "Violation of community standards"}`,
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: "Account is temporarily suspended",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session token",
    });
  }
};

export const adminOnly = async (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin privilege required",
    });
  }
  next();
};