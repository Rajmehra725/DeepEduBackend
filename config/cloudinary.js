import dotenv from "dotenv";
dotenv.config();

import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {

    const isVideo = file.mimetype.startsWith("video");

    return {
      folder: "news_uploads",
      public_id: Date.now() + "-" + file.originalname,

      resource_type: "auto", // 🔥 image + video both

      allowed_formats: [
        "jpg", "png", "jpeg", "webp",
        "mp4", "mov", "avi", "webm" // 🎥 video formats
      ],

      ...(isVideo
        ? {}
        : {
            transformation: [
              { width: 800, height: 500, crop: "limit" }
            ],
          }),
    };
  },
});

export default cloudinary;