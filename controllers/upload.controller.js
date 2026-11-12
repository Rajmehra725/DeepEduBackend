import cloudinary from "../config/cloudinary.js";

/**
 * Universal media & document uploader.
 * Supports:
 * 1. Base64 / Data URI payloads ({ base64: "...", filename: "...", folder: "..." })
 * 2. Multipart form uploads (req.file populated by multer)
 */
export const uploadFile = async (req, res) => {
  try {
    const schoolId = req.schoolId || "global";
    const { base64, filename, folder = "deepedu_uploads", resourceType = "auto" } = req.body;

    // Check if multipart file from multer
    if (req.file) {
      return res.status(200).json({
        success: true,
        message: "File uploaded successfully",
        data: {
          url: req.file.path || req.file.secure_url,
          publicId: req.file.filename || req.file.public_id,
          format: req.file.format || req.file.mimetype,
          size: req.file.size,
          originalName: req.file.originalname,
        },
      });
    }

    // Base64 upload
    if (base64) {
      const uploadTarget = base64.startsWith("data:")
        ? base64
        : `data:image/jpeg;base64,${base64}`;

      const uploadResult = await cloudinary.uploader.upload(uploadTarget, {
        folder: `deepedu/${schoolId}/${folder}`,
        resource_type: resourceType,
        public_id: filename ? `${Date.now()}_${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}` : undefined,
      });

      return res.status(200).json({
        success: true,
        message: "File uploaded successfully",
        data: {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          format: uploadResult.format,
          resourceType: uploadResult.resource_type,
          bytes: uploadResult.bytes,
          originalName: filename || "upload",
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: "No file or base64 data provided for upload",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload file to Cloudinary",
      error: error.message,
    });
  }
};
