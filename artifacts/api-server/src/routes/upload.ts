import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const name = crypto.randomBytes(12).toString("hex");
    cb(null, `${name}${ext}`);
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, GIF, and AVIF images are allowed."));
  },
});

const mediaUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml",
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

function getMimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    gif: "image/gif", avif: "image/avif", svg: "image/svg+xml",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", avi: "video/x-msvideo",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] ?? "application/octet-stream";
}

function fileTypeCategory(mime: string): "image" | "video" | "document" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || mime.includes("word") || mime.includes("presentation") || mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("powerpoint")) return "document";
  return "other";
}

router.post("/image", requireAuth, imageUpload.single("image"), (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No image file provided" }); return; }
  const url = `/api/files/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

router.post("/file", requireAdmin, mediaUpload.single("file"), (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  const url = `/api/files/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, originalName: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype });
});

router.get("/admin/files", requireAdmin, (_req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const result = files
      .map(filename => {
        const filepath = path.join(UPLOADS_DIR, filename);
        const stat = fs.statSync(filepath);
        const ext = path.extname(filename).toLowerCase().slice(1);
        const mime = getMimeFromExt(ext);
        return {
          filename,
          url: `/api/files/${filename}`,
          size: stat.size,
          uploadedAt: stat.mtime.toISOString(),
          mimetype: mime,
          type: fileTypeCategory(mime),
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    res.json(result);
  } catch {
    res.json([]);
  }
});

router.delete("/admin/files/:filename", requireAdmin, (req, res) => {
  const { filename } = req.params;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    res.status(400).json({ error: "Invalid filename" }); return;
  }
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "File not found" }); return;
  }
  fs.unlinkSync(filepath);
  res.json({ success: true });
});

export default router;
