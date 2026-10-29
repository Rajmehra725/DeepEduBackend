import GalleryAlbum from "../models/GalleryAlbum.js";

export const listAlbums = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { category, status } = req.query;

    const filter = { schoolId };
    if (category) filter.category = category;

    // Non-staff can only see published and active albums
    if (["student", "parent"].includes(req.user.role)) {
      filter.isPublished = true;
      filter.status = "active";
    } else {
      filter.status = status || "active";
    }

    const albums = await GalleryAlbum.find(filter)
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: albums.length,
      data: albums,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to list gallery albums",
      error: error.message,
    });
  }
};

export const getAlbumById = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const album = await GalleryAlbum.findOne({ _id: id, schoolId }).populate(
      "createdBy",
      "name role"
    );

    if (!album) {
      return res.status(404).json({
        success: false,
        message: "Album not found",
      });
    }

    if (["student", "parent"].includes(req.user.role) && (!album.isPublished || album.status !== "active")) {
      return res.status(403).json({
        success: false,
        message: "This album is not accessible",
      });
    }

    return res.status(200).json({
      success: true,
      data: album,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch album",
      error: error.message,
    });
  }
};

export const createAlbum = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { title, description, category, coverImage, isPublished, media } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Album title is required",
      });
    }

    const album = await GalleryAlbum.create({
      schoolId,
      title: title.trim(),
      description: description ? description.trim() : "",
      category: category || "General",
      coverImage: coverImage || "",
      isPublished: isPublished !== false,
      media: Array.isArray(media) ? media : [],
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Album created successfully",
      data: album,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create album",
      error: error.message,
    });
  }
};

export const addMediaToAlbum = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    let items = req.body.items;

    // Support single item payload { url, caption, mediaType } or items array
    if (!items && (req.body.url || req.body.coverImage)) {
      items = [
        {
          url: req.body.url || req.body.coverImage,
          caption: req.body.caption || "",
          title: req.body.title || "",
          mediaType: req.body.mediaType || req.body.type || "image",
          publicId: req.body.publicId || "",
        },
      ];
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items array is required with at least one media item",
      });
    }

    const album = await GalleryAlbum.findOne({ _id: id, schoolId });
    if (!album) {
      return res.status(404).json({
        success: false,
        message: "Album not found",
      });
    }

    items.forEach((item) => {
      if (item.url) {
        album.media.push({
          url: item.url,
          caption: item.caption || "",
          title: item.title || "",
          mediaType: item.mediaType || "image",
          publicId: item.publicId || "",
          uploadedAt: new Date(),
        });
        if (!album.coverImage) {
          album.coverImage = item.url;
        }
      }
    });

    await album.save();

    return res.status(200).json({
      success: true,
      message: "Media added successfully",
      data: album,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add media",
      error: error.message,
    });
  }
};

export const toggleAlbumPublish = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const album = await GalleryAlbum.findOne({ _id: id, schoolId });
    if (!album) {
      return res.status(404).json({
        success: false,
        message: "Album not found",
      });
    }

    album.isPublished = !album.isPublished;
    await album.save();

    return res.status(200).json({
      success: true,
      message: `Album ${album.isPublished ? "published" : "unpublished"} successfully`,
      data: album,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to toggle album publication",
      error: error.message,
    });
  }
};

export const archiveAlbum = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;

    const album = await GalleryAlbum.findOneAndUpdate(
      { _id: id, schoolId },
      { status: "archived" },
      { new: true }
    );

    if (!album) {
      return res.status(404).json({
        success: false,
        message: "Album not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Album archived successfully",
      data: album,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to archive album",
      error: error.message,
    });
  }
};
