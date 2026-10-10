import jwt from "jsonwebtoken";

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      phone: user.phone,
      username: user.username,
    },
    process.env.JWT_SECRET || "raazchat_super_secret_jwt_key_2026",
    {
      expiresIn: "7d",
    }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "raazchat_refresh_secret_2026",
    {
      expiresIn: "30d",
    }
  );
};