import mongoose from "mongoose";

const galleryMediaSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    trim: true,
    default: "",
  },
  caption: {
    type: String,
    trim: true,
    default: "",
  },
  mediaType: {
    type: String,
    enum: ["image", "video"],
    default: "image",
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const galleryAlbumSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: [
        "Annual Day",
        "Sports",
        "Academics",
        "Cultural",
        "Excursions",
        "Campus Life",
        "General",
      ],
      default: "General",
      index: true,
    },
    coverImage: {
      type: String,
      default: "",
    },
    media: [galleryMediaSchema],
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

galleryAlbumSchema.index({ schoolId: 1, status: 1, isPublished: 1 });

const GalleryAlbum = mongoose.model("GalleryAlbum", galleryAlbumSchema);
export default GalleryAlbum;
