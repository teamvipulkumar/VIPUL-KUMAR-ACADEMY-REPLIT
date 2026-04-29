import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { uploadFile, deleteFile, listFiles } from "../lib/supabase-storage";

const router = Router();

// Files are buffered in memory and streamed to Supabase Storage. We never
// touch local disk. Multer's memory storage keeps the file on `req.file.buffer`.
const memoryStorage = multer.memoryStorage();

const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, GIF, and AVIF images are allowed."));
  },
});

// Files are buffered in memory before streaming to Supabase, so the limit must
// be conservative to avoid OOM/DoS on the API process. Heavy assets (long
// videos, etc.) should be hosted externally and referenced by URL.
const mediaUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // SECURITY: SVGs intentionally excluded — they're XML and can carry inline
    // <script> / event handlers, which would execute as the same origin as the
    // public Supabase Storage URL the file is served from.
    const allowed = [
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
      "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("File type not allowed."));
  },
});

function generateFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".bin";
  const name = crypto.randomBytes(12).toString("hex");
  return `${name}${ext}`;
}

router.post("/image", requireAuth, imageUpload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No image file provided" }); return; }
  try {
    const filename = generateFilename(req.file.originalname);
    const url = await uploadFile(filename, req.file.buffer, req.file.mimetype);
    res.json({ url, filename });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

router.post("/file", requireAdmin, mediaUpload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  try {
    const filename = generateFilename(req.file.originalname);
    const url = await uploadFile(filename, req.file.buffer, req.file.mimetype);
    res.json({
      url,
      filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

function fileTypeCategory(mime: string): "image" | "video" | "document" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || mime.includes("word") || mime.includes("presentation") || mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("powerpoint")) return "document";
  return "other";
}

router.get("/admin/files", requireAdmin, async (_req, res) => {
  try {
    const files = await listFiles();
    res.json(files.map(f => ({ ...f, type: fileTypeCategory(f.mimetype) })));
  } catch (err) {
    console.warn("[upload] list failed:", err);
    res.json([]);
  }
});

router.delete("/admin/files/:filename", requireAdmin, async (req, res) => {
  const filename = String(req.params.filename ?? "");
  if (!filename || filename.includes("..") || filename.includes("/")) {
    res.status(400).json({ error: "Invalid filename" }); return;
  }
  try {
    await deleteFile(filename);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Delete failed" });
  }
});

export default router;
