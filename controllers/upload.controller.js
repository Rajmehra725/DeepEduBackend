import cloudinary from "../config/cloudinary.js";

/**
 * Universal media & document uploader.
 * Supports:
 * 1. Base64 / Data URI payloads ({ base64: "...", data: "...", filename: "...", folder: "..." })
 * 2. Multipart form uploads (req.file buffer streamed directly to Cloudinary)
 * Server-side school ownership verification via req.schoolId
 */
export const uploadFile = async (req, res) => {
  try {
    const schoolId = req.schoolId || "global";
    const { base64, data, filename, folder = "deepedu_uploads", resourceType = "auto" } = req.body || {};

    // 1. Check if multipart file buffer from multer
    if (req.file && req.file.buffer) {
      const allowedMimes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `Invalid file type (${req.file.mimetype}). Allowed types: JPG, PNG, WEBP, GIF, SVG, PDF, DOC, DOCX`,
        });
      }

      const isImage = req.file.mimetype.startsWith("image/");
      const determinedResourceType = resourceType !== "auto" ? resourceType : (isImage ? "image" : "auto");

      const uploadStreamResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `deepedu/${schoolId}/${folder}`,
            resource_type: determinedResourceType,
            public_id: filename
              ? `${Date.now()}_${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}`
              : `${Date.now()}_upload`,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      return res.status(200).json({
        success: true,
        message: "File uploaded successfully",
        data: {
          url: uploadStreamResult.secure_url,
          publicId: uploadStreamResult.public_id,
          format: uploadStreamResult.format,
          resourceType: uploadStreamResult.resource_type,
          bytes: uploadStreamResult.bytes,
          originalName: req.file.originalname,
        },
      });
    }

    // 2. Base64 or Data URI upload
    const payloadData = base64 || data;
    if (payloadData && typeof payloadData === "string") {
      let uploadTarget = payloadData.trim();
      let isImage = false;

      if (uploadTarget.startsWith("data:")) {
        isImage = uploadTarget.startsWith("data:image/");
      } else {
        uploadTarget = `data:image/jpeg;base64,${uploadTarget}`;
        isImage = true;
      }

      const determinedResourceType = resourceType !== "auto" ? resourceType : (isImage ? "image" : "auto");

      const uploadResult = await cloudinary.uploader.upload(uploadTarget, {
        folder: `deepedu/${schoolId}/${folder}`,
        resource_type: determinedResourceType,
        public_id: filename
          ? `${Date.now()}_${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}`
          : `${Date.now()}_upload`,
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
      message: "No file buffer or base64 data provided for upload",
    });
  } catch (error) {
    console.error("Upload error details:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload file to cloud storage",
      error: error.message,
    });
  }
};
