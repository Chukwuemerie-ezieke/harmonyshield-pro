import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

/**
 * Evidence file-upload configuration.
 *
 * Compliance evidence is written to a local disk directory (configurable via
 * UPLOAD_DIR, default ./uploads) which is gitignored so uploaded binaries are
 * never committed. Files are given an opaque random name on disk; the original
 * client filename is preserved in the DB row (compliance_evidence.originalName)
 * for display only, never used as a path.
 *
 * Constraints:
 *   - Max file size: UPLOAD_MAX_BYTES (default 5 MiB).
 *   - Allowed MIME types: a conservative allowlist of document/image types.
 */

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), "uploads");

export const UPLOAD_MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 5 * 1024 * 1024;

// Conservative allowlist of evidence file types.
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

const storageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureUploadDir();
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err as Error, UPLOAD_DIR);
    }
  },
  filename: (_req, file, cb) => {
    // Opaque on-disk name; preserve only the extension from the original name.
    const ext = path.extname(file.originalname).slice(0, 10);
    cb(null, `${randomUUID()}${ext}`);
  },
});

/**
 * Multer middleware for a single evidence file field named "file". Rejects
 * disallowed MIME types (400 via fileFilter -> handler) and oversized uploads
 * (multer LIMIT_FILE_SIZE error, mapped to 400 in the route).
 */
export const evidenceUpload = multer({
  storage: storageEngine,
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});
