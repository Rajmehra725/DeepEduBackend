import express from "express";
import {
  listAlbums,
  getAlbumById,
  createAlbum,
  addMediaToAlbum,
  toggleAlbumPublish,
  archiveAlbum,
} from "../controllers/gallery.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { requireTenant } from "../middleware/tenant.js";

const router = express.Router();

router.use(authenticate, requireTenant);

// Publicly viewable within school (students, parents, teachers, principal)
router.get("/", listAlbums);
router.get("/:id", getAlbumById);

// Management (Principal & Superadmin)
router.post("/", authorize("principal", "superadmin"), createAlbum);
router.post("/:id/media", authorize("principal", "superadmin"), addMediaToAlbum);
router.patch("/:id/publish", authorize("principal", "superadmin"), toggleAlbumPublish);
router.delete("/:id", authorize("principal", "superadmin"), archiveAlbum);

export default router;
