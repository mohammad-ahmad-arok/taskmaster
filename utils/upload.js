const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Temp local staging only — files land here briefly, get streamed to
// Google Drive by the controller, then get deleted. Nothing here is
// meant to persist (Render's disk is ephemeral anyway).
const uploadDir = path.join(__dirname, '..', 'uploads', 'task-attachments');
fs.mkdirSync(uploadDir, { recursive: true });

// Files now go to Google Drive rather than being served directly, and
// need to support large uploads (videos, archives, etc. up to 500MB), so
// instead of a narrow allow-list we block only genuinely dangerous
// executable/script types. Drive itself will still run its own malware
// scan on download for anything it flags.
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.scr',
  '.js', '.vbs', '.ps1', '.jar', '.apk', '.app', '.dmg',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).slice(0, 10);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB, per requirement
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error('File type not allowed'));
    }
    cb(null, true);
  },
});

module.exports = upload;
