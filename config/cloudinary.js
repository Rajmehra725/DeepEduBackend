import dotenv from "dotenv";
dotenv.config();

import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Authoritative Cloudinary configuration with fallback credentials from environment
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "lpvxbdd5";
const API_KEY = process.env.CLOUDINARY_API_KEY || "958389652937871";
const API_SECRET = process.env.CLOUDINARY_API_SECRET || "0Rh1DNRXZQXFB9_FclWWvNLR0DM";

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true,
});

export const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video");

    return {
      folder: "deepedu_uploads",
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
      resource_type: "auto",
      allowed_formats: [
        "jpg", "png", "jpeg", "webp", "gif", "svg",
        "mp4", "mov", "avi", "webm",
        "pdf", "doc", "docx"
      ],
      ...(isVideo
        ? {}
        : {
            transformation: [
              { width: 1200, height: 1200, crop: "limit" }
            ],
          }),
    };
  },
});

export default cloudinary;
