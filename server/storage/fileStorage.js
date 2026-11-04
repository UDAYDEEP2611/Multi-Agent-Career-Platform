const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

// Local disk storage. Swap this module for cloud storage (S3, Cloudinary)
// later; callers only use saveFile, getFilePath and deleteFile.
// UPLOAD_DIR lets tests write to a temporary folder instead
const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads")
);

const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx"
};

// Keys look like "experience-media/<random>.<ext>" and never come from user input
function resolveKey(key) {
  const fullPath = path.resolve(UPLOAD_ROOT, key);

  if (!fullPath.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new Error("Invalid file key");
  }

  return fullPath;
}

async function saveFile(folder, buffer, mimeType) {
  const key = `${folder}/${crypto.randomUUID()}${extensions[mimeType]}`;
  const fullPath = resolveKey(key);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  return key;
}

function getFilePath(key) {
  return resolveKey(key);
}

async function deleteFile(key) {
  if (!key) return;

  try {
    await fs.unlink(resolveKey(key));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Delete file error:", error);
    }
  }
}

module.exports = {
  allowedMimeTypes: Object.keys(extensions),
  saveFile,
  getFilePath,
  deleteFile
};
