const { AsyncLocalStorage } = require("node:async_hooks");
const multer = require("multer");
const JSZip = require("jszip");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const typeLabels = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/pdf": "PDF",
  [DOCX]: "DOCX",
  [PPTX]: "PPTX"
};

const IMAGE_AND_PDF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

const DOCUMENT_TYPES = [...IMAGE_AND_PDF_TYPES, DOCX, PPTX];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 10 }
});

// DOCX/PPTX are ZIP archives; tell them apart by their required entries.
// Only the archive's directory is read, nothing is decompressed.
async function detectOfficeType(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);

    if (!zip.file("[Content_Types].xml")) return null;
    if (zip.file("word/document.xml")) return DOCX;
    if (zip.file("ppt/presentation.xml")) return PPTX;
  } catch {
    // Not a readable ZIP archive
  }

  return null;
}

// Detect the real file type from its contents, not the name or browser-sent type
async function detectMimeType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  )) {
    return "image/png";
  }

  if (buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }

  if (buffer.toString("ascii", 0, 5) === "%PDF-") {
    return "application/pdf";
  }

  if (buffer.toString("ascii", 0, 4) === "PK\u0003\u0004") {
    return detectOfficeType(buffer);
  }

  return null;
}

function listTypes(types) {
  const labels = types.map((type) => typeLabels[type]);
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

// Accepts one file in the "file" field (plus text fields) and sets
// req.file.detectedType. Rejects files whose contents are not in allowedTypes.
function singleFileUpload(allowedTypes) {
  return (req, res, nextInRequest) => {
    // Multer finishes from the upload stream's events, outside this
    // request's context; bind next so the handler still uses the user's
    // database (see utils/userDatabase.js)
    const next = AsyncLocalStorage.bind(nextInRequest);

    upload.single("file")(req, res, async (error) => {
      if (error) {
        const message = error.code === "LIMIT_FILE_SIZE"
          ? "File is too large (maximum 10 MB)"
          : "Unable to read uploaded file";

        return res.status(400).json({ success: false, message });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded"
        });
      }

      const detectedType = await detectMimeType(req.file.buffer);

      if (!allowedTypes.includes(detectedType)) {
        return res.status(400).json({
          success: false,
          message: `Only ${listTypes(allowedTypes)} files are allowed`
        });
      }

      req.file.detectedType = detectedType;
      next();
    });
  };
}

// A resume to compare with a job: PDF, DOCX, RTF or plain text (.txt, .md).
// Old binary Word files (.doc) can't be read reliably, so they get a clear
// message. Sets req.file.detectedType like singleFileUpload.
function resumeFileUpload(req, res, nextInRequest) {
  const next = AsyncLocalStorage.bind(nextInRequest);

  upload.single("file")(req, res, async (error) => {
    if (error) {
      const message = error.code === "LIMIT_FILE_SIZE" ? "File is too large (maximum 10 MB)" : "Unable to read uploaded file";
      return res.status(400).json({ success: false, message });
    }
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const { buffer, originalname = "" } = req.file;
    let type = await detectMimeType(buffer);
    if (!type && buffer.toString("ascii", 0, 5) === "{\\rtf") type = "application/rtf";
    if (!type && buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) {
      return res.status(400).json({ success: false, message: "Old Word files (.doc) can't be read. Save it as DOCX or PDF and upload that." });
    }
    // Plain text: a .txt/.md name and no binary bytes
    if (!type && /\.(txt|md|text)$/i.test(originalname) && !buffer.subarray(0, 4096).includes(0)) type = "text/plain";

    if (![...["application/pdf", DOCX], "application/rtf", "text/plain"].includes(type)) {
      return res.status(400).json({ success: false, message: "Upload the resume as PDF, DOCX, RTF or TXT" });
    }
    req.file.detectedType = type;
    return next();
  });
}

module.exports = {
  uploadSingleFile: singleFileUpload(IMAGE_AND_PDF_TYPES),
  uploadDocumentFile: singleFileUpload(DOCUMENT_TYPES),
  uploadResumeFile: resumeFileUpload
};
